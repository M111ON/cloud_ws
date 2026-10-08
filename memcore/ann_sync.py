#!/usr/bin/env python3
"""ann_sync.py — keep the ANN index (:8096) in step with the memcore store.

memory_daemon.py embeds new chat/fact rows into
    I:\\tools\\cloud_ws\\memcore\\fact_store.v2.sqlite3
but the ANN server serves a DERIVED index
    I:\\tools\\ann\\data\\memcore\\kv_index.jsonl
that nothing rebuilds on its own — so without this step the :8096 index
silently drifts behind the store (it was last built 2026-10-08, the store keeps
growing).

This closes that gap and is deliberately SEPARATE from the daemon (the daemon
file is not touched):

  1. signature the store (entries/embeddings counts + max rowid)
  2. unchanged since the last sync -> exit 0 (cheap no-op)
  3. else  python ann\\scripts\\build_index.py --db <store> --out <index>
          POST  http://127.0.0.1:8096/v1/state/regrow   (trains anchors)
  4. record the synced signature in .ann_sync_state.json

Idempotent and single-instanced; safe to run on a schedule beside the daemon.
The store is opened READ-ONLY and every index write is atomic (build_index
uses tmp+rename; regrow does the same), so a running server is never read
half-written.

Usage:
    python ann_sync.py                # sync if the store moved
    python ann_sync.py --dry-run      # show the plan, touch nothing
    python ann_sync.py --force        # rebuild even if the signature matches
    python ann_sync.py --adopt        # mark the CURRENT store as synced
                                      # (once, on an already-in-sync box)
    python ann_sync.py --no-regrow    # build the base index only (no POST)
"""
import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
STORE = os.environ.get("MEMCORE_STORE_DB",
                       str(HERE / "fact_store.v2.sqlite3"))
ANN_ROOT = os.environ.get("ANN_ROOT", r"I:\tools\ann")
BUILD_INDEX = os.path.join(ANN_ROOT, "scripts", "build_index.py")
INDEX_OUT = os.environ.get("ANN_INDEX_OUT",
                           os.path.join(ANN_ROOT, "data", "memcore",
                                        "kv_index.jsonl"))
ANN_BASE = os.environ.get("MEMCORE_ANN_URL", "http://127.0.0.1:8096").rstrip("/")
REGROW_URL = ANN_BASE + "/v1/state/regrow"
HEALTH_URL = ANN_BASE + "/health"
STATE = str(HERE / ".ann_sync_state.json")
LOCK = str(HERE / ".ann_sync.lock")
LOG = str(HERE / ".ann_sync.log")
# build_index writes ~index_size as a .tmp before rename and regrow does the
# same again, so peak is roughly 2x the index; leave headroom.
MIN_FREE_MB = int(os.environ.get("ANN_SYNC_MIN_FREE_MB", "600"))


def log(msg):
    line = "%s  %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


# ── single instance (stale PID is reclaimed, same lesson as the daemon) ──
def _pid_alive(pid):
    try:
        import ctypes
        h = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not h:
            return False
        try:
            code = ctypes.c_ulong()
            if not ctypes.windll.kernel32.GetExitCodeProcess(
                    h, ctypes.byref(code)):
                return False
            return code.value == 259  # STILL_ACTIVE
        finally:
            ctypes.windll.kernel32.CloseHandle(h)
    except Exception:
        return False


def acquire_lock():
    for _ in range(2):
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return True
        except FileExistsError:
            try:
                pid = int((Path(LOCK).read_text() or "0").strip())
            except (OSError, ValueError):
                pid = 0
            if pid and _pid_alive(pid):
                return False
            try:
                os.remove(LOCK)
            except OSError:
                return False
    return False


def release_lock():
    try:
        if int((Path(LOCK).read_text() or "0").strip()) == os.getpid():
            os.remove(LOCK)
    except (OSError, ValueError):
        pass


# ── signatures / probing ──
def store_sig(db):
    """Monotone signature: the daemon only INSERTs (INSERT OR IGNORE), so
    count + max rowid changes iff new content landed."""
    con = sqlite3.connect("file:%s?mode=ro" % db, uri=True, timeout=10)
    try:
        n = con.execute("SELECT count(*) FROM entries").fetchone()[0]
        m = con.execute("SELECT count(*) FROM embeddings").fetchone()[0]
        mx = con.execute("SELECT coalesce(max(rowid),0) FROM entries").fetchone()[0]
    finally:
        con.close()
    return "%d:%d:%d" % (n, m, mx)


def _norm(p):
    return os.path.normcase(os.path.normpath(str(p)))


def _tcp_up():
    """Raw connect: tells 'truly down' (refused) from 'busy' (accepts but
    /health is slow — it pings the embed sidecar on every call, so it can
    take >10s right after a regrow)."""
    import socket
    from urllib.parse import urlparse
    try:
        u = urlparse(ANN_BASE)
        host = u.hostname or "127.0.0.1"
        port = u.port or 80
    except Exception:
        host, port = "127.0.0.1", 8096
    try:
        with socket.create_connection((host, port), timeout=5):
            return True
    except OSError:
        return False


def ann_health(retries=3, timeout=30):
    for i in range(retries):
        try:
            with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if i + 1 < retries:
                time.sleep(2)
    return None


def regrow():
    req = urllib.request.Request(REGROW_URL, data=b"{}",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read().decode("utf-8"))


def free_mb(path):
    return shutil.disk_usage(path).free // (1024 * 1024)


def load_state():
    try:
        return json.loads(Path(STATE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(st):
    Path(STATE).write_text(json.dumps(st, indent=0), encoding="utf-8")


def build_index(out):
    cmd = [sys.executable, BUILD_INDEX, "--db", STORE, "--out", out]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    tail = (r.stdout or "").strip().splitlines()[-1:] or [""]
    return r.returncode, tail[0], (r.stderr or "")[-500:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--adopt", action="store_true",
                    help="record the current store as already synced")
    ap.add_argument("--no-regrow", action="store_true")
    ap.add_argument("--db", default=STORE)
    ap.add_argument("--out", default=INDEX_OUT)
    a = ap.parse_args()
    globals()["STORE"] = a.db
    out = a.out

    if not os.path.exists(STORE):
        log("ann_sync: store not found: %s" % STORE)
        return 2
    sig = store_sig(STORE)
    st = load_state()

    if a.adopt:
        st = {"built": sig, "regrow": sig, "synced": sig}
        if not a.dry_run:
            save_state(st)
        log("ann_sync: adopted current store as synced (%s)" % sig)
        return 0

    if not a.force and st.get("synced") == sig:
        log("ann_sync: in sync (%s), nothing to do" % sig)
        return 0

    # disk guard before any 200MB+ write
    fm = free_mb(os.path.dirname(os.path.abspath(out)) or ".")
    if fm < MIN_FREE_MB:
        log("ann_sync: only %d MB free (< %d) — refusing to rebuild"
            % (fm, MIN_FREE_MB))
        return 3

    if a.dry_run:
        log("ann_sync[DRY]: would build %s from store %s, then POST %s "
            "(free %d MB)" % (out, sig, REGROW_URL, fm))
        return 0

    if not acquire_lock():
        log("ann_sync: another sync is running, exiting")
        return 0
    try:
        # 1. base index (no anchors) — pure function of the store
        if a.force or st.get("built") != sig:
            rc, tail, err = build_index(out)
            if rc != 0:
                log("ann_sync: build_index FAILED rc=%d %s" % (rc, err))
                return 4
            log("ann_sync: built base index (%s) from store %s" % (tail, sig))
            st["built"] = sig
            save_state(st)

        # 2. train anchors server-side so the index is routable
        if a.no_regrow:
            log("ann_sync: --no-regrow, base index only")
            return 0
        if st.get("regrow") == sig and not a.force:
            st["synced"] = sig
            save_state(st)
            log("ann_sync: anchors already current for %s" % sig)
            return 0
        h = ann_health()
        if h is None:
            if _tcp_up():
                log("ann_sync: ANN server busy (port open, /health slow) — "
                    "built only, regrow deferred to next run")
            else:
                log("ann_sync: ANN server down at %s — built only, "
                    "regrow deferred" % ANN_BASE)
            return 0
        served = h.get("index")
        if served and _norm(served) != _norm(out):
            log("ann_sync: REFUSING regrow — server serves %s, we built %s"
                % (served, out))
            return 5
        try:
            r = regrow()
        except Exception as e:
            log("ann_sync: regrow POST failed: %s" % e)
            return 6
        if r.get("status") != "ok":
            log("ann_sync: regrow returned %s" % r)
            return 6
        st["regrow"] = sig
        st["synced"] = sig
        save_state(st)
        log("ann_sync: regrow ok (%s, nent=%s K=%s) — index in sync"
            % (r.get("mode"), r.get("nent"), r.get("K")))
        return 0
    finally:
        release_lock()


if __name__ == "__main__":
    sys.exit(main())
