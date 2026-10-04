#!/usr/bin/env python3
"""
freebuff_daemon.py — tail chat logs into memcore v2 (local only).

Collectors (all incremental, never full-scan):
  freebuff  <root>/.freebuff/desktop-v2.db, auto-discovered under I:/
            (seq-based resume; idle-gated on db mtime)
  hermes    I:/keep/hms/chat_exports/*.md — state.db exports, Variant A
            (content-hash per file; only new/changed files are parsed)
  opencode  I:/OpenCode-data/opencode.db (2.8GB) via export_sessions.py
            --out WORKDIR, which keeps its own .last_export marker so only
            sessions with time_updated >= marker are dumped; fast-path skips
            the export entirely when db+wal mtimes are untouched.
            Export JSON -> turns -> same pipeline.

  chatpool  I:/tools/chat-pool/log.jsonl (append-only bus, byte-offset)
  memo      ./memos.jsonl from memo_capture.py (raw one-fact-per-line)

New rows go through strip_boilerplate + extract_brainstorm and are embedded
straight into fact_store.v2.sqlite3 — no LLM step
(synthesize.py stays a nightly batch). v2's content-hash id skip makes
re-runs and mid-exchange cuts duplicate-free.

State is checkpointed as each collector finishes, not once at the end of
run_once: a pass longer than the scheduled interval must still record what it
completed, or the next pass redoes the whole corpus and can never finish.

Usage:
    python freebuff_daemon.py --once            # single pass (for schtask)
    python freebuff_daemon.py --once --dry-run  # show what would embed
    python freebuff_daemon.py --loop            # persistent, every --interval s
    python freebuff_daemon.py --once --only hermes,opencode
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, r"I:\tools\pre_embedding_filter")
sys.path.insert(0, r"I:\tools\chat-pool")

import v2 as store_v2  # noqa: E402
from parser import (Turn, ParsedFile, parse_file,  # noqa: E402
                    merge_consecutive_assistant_turns)
from detector import classify  # noqa: E402
from extractors import strip_boilerplate, extract  # noqa: E402
import pool  # noqa: E402 — the block grammar, read from its own module

SCAN_ROOT = "I:/"
HERMES_DIR = r"I:\keep\hms\chat_exports"
CHATPOOL_LOG = r"I:\tools\chat-pool\log.jsonl"
# bond and pointer are NOT ingested, and this is the chat-pool side that decides
# it, not us: pool.py carries `INDEX_SKIP_KINDS = ("bond", "pointer")  # graph
# data: query via /explore, not search`, so the pool's own semantic index drops
# them too. A bond is "<64-hex> <rel> <64-hex>" — its vector would be the
# embedding of two hashes, which carries the RELATION (order, shared term) and
# no meaning; it would dilute every search rather than serve one. Both are
# rebuildable: bond_real.py re-derives every verb from source metadata
# (x-next-in-session from file order, x-same-hint from term_hint,
# x-related-term from a definition naming another term), so nothing is lost
# by keeping them out of a store that cannot be recomputed from the log.
# pointer is 18 chars of dashboard navigation state ("point=1904 level=0").
CHATPOOL_KINDS = ("CHAT", "DECISION", "block")
MEMO_LOG = os.path.join(HERE, "memos.jsonl")
MEMO_DB = os.path.join(HERE, "memos.sqlite3")
# chat-pool is an N-party bus, but the extractors dispatch on the canonical
# "You"/"Assistant" vocabulary, so every app has to be routed onto it. Only
# chatdrop carries both sides and marks them per record ("(user)"/"(ai)" on the
# first line), so it is the only app that can be read as a dialogue. Every other
# app posts independent utterances with no partner to pair against, and
# extract_subagent would collapse each app to a single final summary, so those
# become one fact per message instead.
CP_DIALOGUE_APPS = ("chatdrop",)
CP_ROLE_RE = re.compile(r"^\[[^\]]*\]\s*\((user|ai)\)", re.I)
CP_MIN_CHARS = 80
CP_SEGMENT = 2000       # lines per embed chunk; ~1100 facts ≈ 2 min at 567/min
CP_MIN_SEGMENT = 250
MEM_MIN_MB = 1200       # below this, halve the segment before embedding
MEM_FLOOR_MB = 600      # below this, defer chatpool to the next pass entirely


def mem_free_mb():
    try:
        import ctypes

        class MS(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong),
                        ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong),
                        ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong),
                        ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        ms = MS()
        ms.dwLength = ctypes.sizeof(MS)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
        return ms.ullAvailPhys // (1024 * 1024)
    except Exception:
        return 1 << 30


MEM_MAX_MB = int(os.environ.get("DAEMON_MEM_MB", "2500"))
DAEMON_LOCK = str(HERE / ".daemon.lock")


def rss_mb():
    try:
        import ctypes

        class PMC(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_ulong),
                        ("PageFaultCount", ctypes.c_ulong),
                        ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t)]
        pmc = PMC()
        pmc.cb = ctypes.sizeof(PMC)
        h = ctypes.windll.kernel32.GetCurrentProcess()
        if ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc),
                                                    pmc.cb):
            return pmc.WorkingSetSize // (1024 * 1024)
    except Exception:
        pass
    return 0


def _pid_alive(pid):
    try:
        import ctypes
        h = ctypes.windll.kernel32.OpenProcess(0x100000, False, pid)
        if not h:
            return False
        ctypes.windll.kernel32.CloseHandle(h)
        return True
    except Exception:
        return True


def acquire_lock():
    try:
        fd = os.open(DAEMON_LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        pass
    try:
        with open(DAEMON_LOCK, "r") as fh:
            pid = int((fh.read() or "0").strip())
    except (OSError, ValueError):
        pid = 0
    if pid and _pid_alive(pid):
        return False
    try:
        os.remove(DAEMON_LOCK)
    except OSError:
        return False
    return acquire_lock()


def release_lock():
    try:
        with open(DAEMON_LOCK, "r") as fh:
            if int((fh.read() or "0").strip()) == os.getpid():
                os.remove(DAEMON_LOCK)
    except (OSError, ValueError):
        pass
OPENCODE_DB = r"I:\OpenCode-data\opencode.db"
OPENCODE_EXPORT = str(HERE / ".opencode_export")
EXPORT_SCRIPT = r"I:\tools\opencode-export\export_sessions.py"
STATE_FILE = str(HERE / ".freebuff_daemon_state.json")
DEFAULT_DB = store_v2.DEFAULT_DB
OVERLAP = 5  # re-read this many msgs before last_seq so pairs survive cuts
PYTHON = sys.executable


def load_state():
    try:
        return json.loads(Path(STATE_FILE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state):
    Path(STATE_FILE).write_text(json.dumps(state, ensure_ascii=False),
                                encoding="utf-8")


PROGRESS_FILE = str(HERE / ".freebuff_progress.json")


def write_progress(patch):
    try:
        cur = {}
        if os.path.exists(PROGRESS_FILE):
            cur = json.loads(Path(PROGRESS_FILE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        cur = {}
    if patch.get("source") != cur.get("source"):
        cur.pop("last_time", None)
        cur.pop("last_txt", None)
    cur.update({k: v for k, v in patch.items() if v is not None})
    cur["updated"] = time.time()
    try:
        Path(PROGRESS_FILE).write_text(json.dumps(cur, ensure_ascii=False),
                                       encoding="utf-8")
    except OSError:
        pass


def _fmt_ts(ts):
    try:
        return time.strftime("%H:%M %d/%m", time.localtime(float(ts)))
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def file_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()[:16]


def turns_to_facts(turns, title, source, pattern):
    """Clean turns -> fact dicts (same shape as main.py, minus Store)."""
    if not turns:
        return []
    pf = ParsedFile(path=source, title=title, session=None, created=None,
                    declared_messages=None, turns=turns)
    cls = classify(pf)
    merged = merge_consecutive_assistant_turns(turns)
    cleaned = []
    for t in merged:
        c = strip_boilerplate(t.content)
        if c:
            cleaned.append(Turn(speaker=t.speaker, time=t.time,
                                content=c, index=t.index))
    out = []
    for fd in extract(pf, cleaned, cls.pattern):
        fd["source_file"] = source
        fd["pattern"] = pattern
        out.append(fd)
    return out


# ---- freebuff collector (seq-based) ----

def discover_dbs(extra_roots):
    dbs = []
    try:
        for d in Path(SCAN_ROOT).iterdir():
            p = d / ".freebuff" / "desktop-v2.db"
            if d.is_dir() and p.exists():
                dbs.append(str(p))
    except OSError:
        pass
    for r in extra_roots:
        p = Path(r) / ".freebuff" / "desktop-v2.db"
        if p.exists() and str(p) not in dbs:
            dbs.append(str(p))
    return sorted(dbs)


def fb_parts_text(parts_json):
    """Join kind=='text' parts only (drops reasoning == strip_think)."""
    try:
        parts = json.loads(parts_json or "[]")
    except (json.JSONDecodeError, TypeError):
        return ""
    return "\n\n".join(
        (p.get("text") or "") for p in parts
        if isinstance(p, dict) and p.get("kind") == "text" and p.get("text")
    ).strip()


def collect_freebuff(db_path, last_seq):
    con = sqlite3.connect("file:%s?mode=ro" % db_path, uri=True)
    try:
        threads = {r[0]: (r[1] or r[0][:8])
                   for r in con.execute("select id, title from threads")}
        rows = con.execute(
            "select seq, thread_id, role, parts_json from messages "
            "where seq > ? order by seq", (max(0, last_seq - OVERLAP),)
        ).fetchall()
    finally:
        con.close()
    if not rows:
        return [], last_seq
    root = Path(db_path).parent.parent.name
    by_thread = {}
    for seq, tid, role, pj in rows:
        by_thread.setdefault(tid, []).append((seq, role, pj))
    facts, max_seq = [], last_seq
    for tid, msgs in by_thread.items():
        turns = []
        for seq, role, pj in msgs:
            max_seq = max(max_seq, seq)
            txt = strip_boilerplate(fb_parts_text(pj))
            if txt:
                turns.append(Turn(
                    speaker="You" if role == "user" else "Assistant",
                    time=None, content=txt, index=seq))
        facts += turns_to_facts(
            turns, threads.get(tid, tid[:8]),
            "freebuff:%s:%s" % (root, tid[:8]), "freebuff")
    return facts, max_seq


# ---- hermes collector (file-hash-based) ----

def collect_hermes(state_files, dry_run):
    facts, seen = [], []
    try:
        paths = sorted(Path(HERMES_DIR).glob("*.md"))
    except OSError:
        return facts, []
    changed = []
    for p in paths:
        try:
            h = file_hash(str(p))
        except OSError:
            continue
        if state_files.get(str(p)) == h:
            continue
        changed.append((p, h))
    for p, h in changed:
        try:
            pf = parse_file(str(p))
        except Exception as e:
            print("hermes: skip %s (%s)" % (p.name, e))
            continue
        facts += turns_to_facts(
            pf.turns, pf.title or p.stem, "hermes:%s" % p.name, "hermes")
        seen.append((str(p), h))
        if dry_run:
            print("hermes:%s: %d turns" % (p.name, len(pf.turns)))
    return facts, seen


# ---- opencode collector (export-increment + file-hash) ----

def opencode_export(state, now):
    """Run incremental export unless db+wal untouched since last pass."""
    try:
        mtimes = (os.path.getmtime(OPENCODE_DB),
                  os.path.getmtime(OPENCODE_DB + "-wal"))
    except OSError:
        return []
    oc = state.setdefault("opencode", {})
    if oc.get("checked_mtimes") == list(mtimes):
        return []  # nothing written since last pass
    Path(OPENCODE_EXPORT).mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [PYTHON, EXPORT_SCRIPT, "--db", OPENCODE_DB, "--out", OPENCODE_EXPORT],
        capture_output=True, text=True, timeout=1800)
    print("opencode export: %s" % (r.stdout or "").strip().splitlines()[-1:])
    oc["checked_mtimes"] = list(mtimes)
    oc["checked_ts"] = now
    if r.returncode != 0:
        print("opencode export FAILED: %s" % (r.stderr or "")[-500:])
        return []
    return sorted(str(p) for p in Path(OPENCODE_EXPORT).glob("ses_*.json"))


def oc_parts_text(parts):
    """Text parts only; tool I/O and reasoning dropped (strip equivalents)."""
    return "\n\n".join(
        (p.get("text") or "") for p in parts
        if isinstance(p, dict) and p.get("type") == "text" and p.get("text")
    ).strip()


def collect_opencode(state, now, dry_run):
    facts = []
    files = state.setdefault("files", {})
    try:
        for jf in opencode_export(state, now):
            try:
                h = file_hash(jf)
            except OSError:
                continue
            if files.get(jf) == h:
                continue
            try:
                data = json.loads(Path(jf).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            info = data.get("info") or {}
            turns = []
            for i, m in enumerate(data.get("messages") or []):
                role = (m.get("info") or {}).get("role")
                txt = strip_boilerplate(oc_parts_text(m.get("parts") or []))
                if not txt:
                    continue
                turns.append(Turn(
                    speaker="You" if role == "user" else "Assistant",
                    time=None, content=txt, index=i))
            facts += turns_to_facts(
                turns, info.get("title") or Path(jf).stem,
                "opencode:%s" % Path(jf).stem, "opencode")
            files[jf] = h
            if dry_run:
                print("opencode:%s: %d turns" % (Path(jf).name, len(turns)))
    except Exception as e:
        print("opencode: collector error: %s" % e)
    return facts


# ---- chat-pool collector (append-only bus, byte-offset resume) ----

def block_facts(o, p):
    """One chat-pool block -> 2 facts. A block is knowledge that was already
    distilled, so it is stored by its own fields instead of as prose.

    The split follows what the fields are actually for: title is how someone
    looks a piece of work up (58 chars average, present on all 59 blocks), so
    it stands alone and carries the slug for a second way in. story+method go
    together because they are one narrative and cutting between them severs
    the argument. evidence and refs are appended to that second fact rather
    than split out — measured on the real 59 blocks, evidence is non-empty on
    only 2 of them and refs on none, so a separate fact for each would be two
    empty rows and 59 thin ones.

    slug lands in source_file so a search result names the block, and status
    plus rev ride along so a reader can tell open work from closed."""
    src = "chatpool:block/%s" % p["slug"]
    head = "[block:%s] %s (status=%s rev=%d)" % (
        p["slug"], p["title"], p.get("status") or "open", int(p.get("rev") or 1))
    body = "[block:%s] %s" % (p["slug"], p["story"])
    for key in ("method", "evidence", "refs"):
        v = (p.get(key) or "").strip()
        if v:
            body += "\n%s: %s" % (key, v)
    out = [{"content": head, "source_file": src, "pattern": "chatpool",
            "kind": "chatlog", "term_hint": "chatpool:%s" % p["slug"]}]
    if len(body) > len(head):
        out.append({"content": body, "source_file": src,
                    "pattern": "chatpool", "kind": "chatlog",
                    "term_hint": "chatpool:%s" % p["slug"]})
    return out


def collect_chatpool(state, now, dry_run, max_lines=CP_SEGMENT):
    """Append-only JSONL cross-app bus. Reads at most max_lines new lines from
    the saved byte offset and returns (facts, end_off, more, info), so the caller can
    embed + checkpoint one segment at a time instead of holding the whole
    backlog. bond/pointer/block are index bookkeeping, not conversation."""
    cp = state.setdefault("chatpool", {})
    off = int(cp.get("offset") or 0)
    try:
        size = os.path.getsize(CHATPOOL_LOG)
    except OSError:
        return [], off, False, {}
    if size < off:              # rotated or truncated -> start over
        off = 0
    if size == off:
        return [], off, False, {}
    try:
        with open(CHATPOOL_LOG, "rb") as fh:
            fh.seek(off)
            blob = fh.read()
    except OSError:
        return [], off, False, {}
    cut = blob.rfind(b"\n")
    if cut < 0:                 # no complete line yet, wait for the writer
        return [], off, False, {}
    base_lines = 0 if size < int(cp.get("offset") or 0) else int(
        cp.get("line") or 0)
    lines = [r for r in blob[:cut + 1].split(b"\n") if r]
    take = lines[:max_lines]
    if take == lines:             # everything fit: also skip trailing newlines
        consumed = cut + 1
    else:
        consumed = sum(len(r) + 1 for r in take)
    more = (off + consumed) < size
    by_app, n_new, n_struct, n_turns, n_blocks, n_block_facts = {}, 0, 0, 0, 0, 0
    facts = []          # block facts land here directly; chat turns below
    try:
        for raw in take:
            n_new += 1
            try:
                o = json.loads(raw.decode("utf-8", "replace"))
            except (json.JSONDecodeError, AttributeError):
                continue
            if o.get("kind") not in CHATPOOL_KINDS:
                n_struct += 1
                continue
            if o.get("kind") == "block":
                # A block is already distilled knowledge, not conversation: it
                # has its own grammar (slug/rev + named fields) and pool.py owns
                # that grammar. Re-parsing its text as a message would throw the
                # slug away and embed the field labels as if they were prose, so
                # it goes through pool's own parser and becomes 2 facts instead.
                parsed = pool.parse_block(o.get("text") or "")
                if not parsed:
                    n_struct += 1
                    continue
                for f in block_facts(o, parsed):
                    facts.append(f)
                    n_block_facts += 1
                n_blocks += 1
                continue
            raw_txt = o.get("text") or ""
            m = CP_ROLE_RE.match(raw_txt.lstrip())
            txt = strip_boilerplate(raw_txt)
            if not txt:
                continue
            app = str(o.get("app") or "?")
            standalone = app not in CP_DIALOGUE_APPS
            spk = "You" if (m and m.group(1).lower() == "user") else "Assistant"
            by_app.setdefault((app, standalone), []).append(
                Turn(speaker=spk, time=o.get("t"), content=txt,
                     index=int(o.get("rkey") or 0)))
            n_turns += 1
    except Exception as e:
        print("chatpool: collector error: %s" % e)
    best = None
    for _turns in by_app.values():
        for _t in _turns:
            if _t.time is not None and (best is None or _t.time > best.time):
                best = _t
    last_t = best.time if best is not None else None
    last_txt = best.content[:120] if best is not None else None
    for (app, sub), turns in sorted(by_app.items()):
        if sub:
            for t in turns:
                if len(t.content) < CP_MIN_CHARS:
                    continue
                facts.append({"content": "[%s] %s" % (app, t.content),
                              "source_file": "chatpool:%s" % app,
                              "pattern": "chatpool", "kind": "chatlog",
                              "term_hint": "chatpool"})
        else:
            facts += turns_to_facts(turns, "chatpool:%s" % app,
                                    "chatpool:%s" % app, "chatpool")
    n_chat_facts = len(facts) - n_block_facts
    end_off = off + consumed
    print("chatpool: %d new lines (%d structural skipped) "
          "-> %d turns -> %d chat facts + %d block facts from %d apps%s" %
          (n_new, n_struct, n_turns, n_chat_facts, n_block_facts,
           len(by_app), " (more)" if more else ""))
    if dry_run:
        for f in facts[:5]:
            print("  %s | %s" % (f["source_file"], f["content"][:100]
                                  .replace("\n", " ")))
        if n_blocks:
            print("  (%d blocks -> %d facts)" % (n_blocks, n_block_facts))
    remaining = len(lines) - len(take)
    info = {"done": base_lines + n_new,
            "total": base_lines + n_new + remaining,
            "last_t": last_t,
            "last_txt": last_txt}
    return facts, end_off, more, info


# ---- memo sidecar collector (raw quick memos, byte-offset resume) ----

def collect_memo(state, dry_run, max_lines=CP_SEGMENT):
    """memos.jsonl written by memo_capture.py. Each line is one raw memo
    {ts, app, cwd, text} — kept raw, no boilerplate strip, one fact per
    line. Returns (facts, end_off, info)."""
    mm = state.setdefault("memo", {})
    off = int(mm.get("offset") or 0)
    try:
        size = os.path.getsize(MEMO_LOG)
    except OSError:
        return [], off, {}
    if size < off:
        off = 0
    if size == off:
        return [], off, {}
    try:
        with open(MEMO_LOG, "rb") as fh:
            fh.seek(off)
            blob = fh.read()
    except OSError:
        return [], off, {}
    cut = blob.rfind(b"\n")
    if cut < 0:
        return [], off, {}
    lines = [r for r in blob[:cut + 1].split(b"\n") if r]
    take = lines[:max_lines]
    consumed = cut + 1 if take == lines else sum(len(r) + 1 for r in take)
    facts, n_new, last_txt, last_t = [], 0, None, None
    for raw in take:
        n_new += 1
        try:
            o = json.loads(raw.decode("utf-8", "replace"))
        except (json.JSONDecodeError, AttributeError):
            continue
        txt = (o.get("text") or "").strip()
        if not txt:
            continue
        facts.append({"content": "[memo] %s" % txt,
                      "source_file": "memo",
                      "pattern": "memo", "kind": "chatlog",
                      "term_hint": "memo"})
        last_txt = txt[:120]
        last_t = o.get("ts")
    print("memo: %d new lines -> %d facts" % (n_new, len(facts)))
    if dry_run:
        for f in facts[:10]:
            print("  memo: %s" % f["content"][:100])
    return facts, off + consumed, {"done": int(mm.get("line") or 0) + n_new,
                                   "last_txt": last_txt, "last_t": last_t}


# ---- embed ----

def embed_facts(facts, db_path, batch=32):
    import numpy as np
    db = sqlite3.connect(db_path)
    db.executescript(store_v2.SCHEMA)
    have = {r[0] for r in db.execute("SELECT id FROM entries")}
    rows = []
    for fd in facts:
        content = (fd.get("content") or "").strip()
        if not content:
            continue
        i = store_v2.eid(fd.get("source_file", ""), content)
        if i in have:
            continue
        rows.append((i, fd.get("source_file", ""), fd.get("pattern", ""),
                     fd.get("term_hint", ""), fd.get("kind", ""), content))
    if not rows:
        return 0
    enc = store_v2._emb()
    for s in range(0, len(rows), batch):
        chunk = rows[s:s + batch]
        vecs = enc.run(["passage: " + c[5][:6000] for c in chunk])
        db.executemany("INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?)",
                       chunk)
        db.executemany(
            "INSERT OR REPLACE INTO embeddings VALUES(?,?,?)",
            [(c[0], store_v2.DIM, v.astype(np.float32).tobytes())
             for c, v in zip(chunk, vecs)])
        db.commit()
    db.execute("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
    db.commit()
    return len(rows)


def run_once(args):
    state = load_state()
    only = set((args.only or "").split(",")) if args.only else set()
    now = time.time()
    total = 0

    if not only or "freebuff" in only:
        fb_n = fb_cand = 0
        fb_last = None
        for db_path in discover_dbs(args.roots):
            try:
                quiet = now - os.path.getmtime(db_path)
            except OSError:
                continue
            if quiet < args.idle:
                print("%s: busy (%.0fs), skip" % (db_path, quiet))
                continue
            last = state.get(db_path, {}).get("last_seq", 0)
            facts, max_seq = collect_freebuff(db_path, last)
            if args.dry_run:
                print("%s: %d candidates (seq %d->%d)" %
                      (db_path, len(facts), last, max_seq))
            else:
                n = embed_facts(facts, args.db) if facts else 0
                state[db_path] = {"last_seq": max_seq, "ts": now}
                if not args.dry_run:
                    save_state(state)
                total += n
                fb_n += n
                fb_cand += len(facts)
                fb_last = max_seq
                write_progress({"source": "freebuff",
                                "done": fb_n, "total": fb_cand,
                                "last_time": None, "last_txt": None,
                                "status": "seq %d" % max_seq,
                                "embedded": total})
                print("%s: embedded %d (seq %d->%d)" %
                      (db_path, n, last, max_seq))
        if not args.dry_run:
            write_progress({"source": "freebuff", "done": fb_n,
                            "total": fb_cand,
                            "status": "caught-up",
                            "embedded": total})

    if not only or "hermes" in only:
        files = state.setdefault("files", {})
        facts, seen = collect_hermes(files, args.dry_run)
        if args.dry_run:
            print("hermes: %d candidates from %d new/changed files" %
                  (len(facts), len(seen)))
        else:
            n = embed_facts(facts, args.db) if facts else 0
            for p, h in seen:
                files[p] = h
            if not args.dry_run:
                save_state(state)
            total += n
            write_progress({"source": "hermes",
                            "done": n, "total": len(facts),
                            "last_time": None, "last_txt": None,
                            "status": "%d files" % len(seen),
                            "embedded": total})
            print("hermes: embedded %d (%d files)" % (n, len(seen)))

    if not only or "opencode" in only:
        facts = collect_opencode(state, now, args.dry_run)
        if args.dry_run:
            print("opencode: %d candidates" % len(facts))
        else:
            n = embed_facts(facts, args.db) if facts else 0
            if not args.dry_run:
                save_state(state)
            total += n
            write_progress({"source": "opencode",
                            "done": n, "total": len(facts),
                            "last_time": None, "last_txt": None,
                            "status": "caught-up",
                            "embedded": total})
            print("opencode: embedded %d" % n)

    if not only or "chatpool" in only:
        seg = CP_SEGMENT
        while True:
            if not args.dry_run and mem_free_mb() < MEM_FLOOR_MB:
                print("chatpool: memory low, deferring remainder to next pass")
                break
            while not args.dry_run and seg > CP_MIN_SEGMENT and \
                    mem_free_mb() < MEM_MIN_MB:
                seg //= 2
            facts, end_off, more, info = collect_chatpool(
                state, now, args.dry_run, seg)
            if args.dry_run:
                print("chatpool: %d candidates" % len(facts))
                break
            if facts:
                n = embed_facts(facts, args.db)
                total += n
                print("chatpool: embedded %d" % n)
            cp = state.setdefault("chatpool", {})
            cp["offset"] = end_off
            cp["ts"] = now
            cp["line"] = info.get("done", cp.get("line", 0))
            save_state(state)
            write_progress({"source": "chatpool",
                            "done": info.get("done", 0),
                            "total": info.get("total", 0),
                            "last_time": _fmt_ts(info.get("last_t")),
                            "last_txt": info.get("last_txt"),
                            "status": "deferred: low memory"
                            if mem_free_mb() < MEM_FLOOR_MB else
                            ("more" if more else "caught-up"),
                            "embedded": total})
            if rss_mb() > MEM_MAX_MB:
                print("daemon: RSS over %d MB, stopping after this segment"
                      % MEM_MAX_MB)
                break
            if not more:
                break

    if not only or "memo" in only:
        facts, end_off, info = collect_memo(state, args.dry_run)
        if args.dry_run:
            print("memo: %d candidates" % len(facts))
        else:
            n = embed_facts(facts, MEMO_DB) if facts else 0
            print("memo: embedded %d -> %s" % (n, MEMO_DB))
            mm = state.setdefault("memo", {})
            mm["offset"] = end_off
            mm["ts"] = now
            mm["line"] = info.get("done", mm.get("line", 0))
            save_state(state)
            write_progress({"source": "memo", "done": info.get("done", 0),
                            "total": info.get("done", 0),
                            "last_time": _fmt_ts(info.get("last_t")),
                            "last_txt": info.get("last_txt"),
                            "status": "caught-up", "embedded": total})
    if not args.dry_run:
        save_state(state)
    print("done: %d new rows -> %s" % (total, args.db))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--loop", action="store_true")
    ap.add_argument("--interval", type=int, default=300)
    ap.add_argument("--idle", type=int, default=120)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--roots", nargs="*", default=[])
    ap.add_argument("--only", default="",
                    help="comma subset: freebuff,hermes,opencode,chatpool")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.dry_run:
        run_once(a)
        return
    if not acquire_lock():
        print("daemon: another pass is running, exiting")
        return
    try:
        if a.loop:
            while True:
                run_once(a)
                time.sleep(a.interval)
        else:
            run_once(a)
    finally:
        release_lock()


if __name__ == "__main__":
    main()
