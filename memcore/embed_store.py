#!/usr/bin/env python3
"""
embed_store.py — embed fact_store.sqlite3 entries via NVIDIA NIM (bge-m3).

Appends vectors into the same store: embeddings(entry_id PK, dim, vec BLOB f32le).
Checkpoint-safe: already-embedded ids are skipped, so crashes/rate-limits cost nothing.

Usage:
    python embed_store.py [--db path] [--limit N] [--workers 5] [--batch 16]
    python embed_store.py --query "..." --k 5     # cosine smoke test
"""
import argparse
import base64
import hashlib
import json
import os
import sqlite3
import struct
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "nvidia/nemotron-3-embed-1b"
KEY_ENV = "NVIDIA_API_KEY"
MAX_CHARS = 1500

_lock = threading.Lock()
_done = [0]


def request_embedding(texts, key):
    payload = json.dumps({
        "input": texts, "model": MODEL, "input_type": "passage",
        "encoding_format": "base64",
    }).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL + "/embeddings", data=payload,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    out = []
    for item in sorted(data["data"], key=lambda d: d["index"]):
        raw = base64.b64decode(item["embedding"])
        out.append(raw)
    return out


def worker(db_path, jobs, key):
    db = sqlite3.connect(db_path)
    for batch in jobs:
        for attempt in range(5):
            try:
                vecs = request_embedding([t for _, t in batch], key)
                if len(vecs) != len(batch):
                    raise RuntimeError(f"len mismatch {len(vecs)}!={len(batch)}")
                break
            except Exception as e:
                if attempt == 4:
                    print(f"[fail] batch of {len(batch)}: {e}", flush=True)
                    vecs = None
                    break
                time.sleep(2 ** attempt)
        if vecs:
            db.executemany(
                "INSERT OR REPLACE INTO embeddings VALUES(?,?,?)",
                [(eid, len(v) // 4, v) for (eid, _), v in zip(batch, vecs)])
            db.commit()
            with _lock:
                _done[0] += len(batch)
                if _done[0] % 500 < len(batch):
                    print(f"  embedded {_done[0]}...", flush=True)
    db.close()


def build(db_path, limit, workers, batch_size):
    key = os.environ.get(KEY_ENV)
    if not key:
        sys.exit(f"missing {KEY_ENV}")
    db = sqlite3.connect(db_path)
    db.execute("""CREATE TABLE IF NOT EXISTS embeddings(
        entry_id TEXT PRIMARY KEY, dim INTEGER, vec BLOB)""")
    rows = db.execute("""
        SELECT e.id, substr(e.term || char(10) || e.body, 1, ?)
        FROM entries e
        LEFT JOIN embeddings m ON m.entry_id = e.id
        WHERE m.entry_id IS NULL""", (MAX_CHARS,)).fetchall()
    if limit:
        rows = rows[:limit]
    total = db.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
    db.close()
    print(f"[info] to embed: {len(rows)} | already done: {total}")
    if not rows:
        return
    batches = [[(r[0], r[1]) for r in rows[i:i + batch_size]]
               for i in range(0, len(rows), batch_size)]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(worker, db_path, batches[j::workers], key)
                for j in range(workers)]
        for f in futs:
            f.result()
    dt = time.time() - t0
    rate = _done[0] / dt if dt else 0
    print(f"[ok] embedded {_done[0]} in {dt:.0f}s ({rate:.0f}/s)")


def query(db_path, q, k):
    key = os.environ.get(KEY_ENV)
    qv = request_embedding([q[:MAX_CHARS]], key)[0]
    n = len(qv) // 4
    qs = struct.unpack(f"<{n}f", qv)
    db = sqlite3.connect(db_path)
    best = []
    for eid, vec in db.execute("SELECT entry_id, vec FROM embeddings"):
        vs = struct.unpack(f"<{len(vec)//4}f", vec)
        dot = sum(a * b for a, b in zip(qs, vs))
        na = sum(a * a for a in qs) ** .5 or 1
        nb = sum(b * b for b in vs) ** .5 or 1
        best.append((dot / (na * nb), eid))
    best.sort(reverse=True)
    for score, eid in best[:k]:
        term, kind = db.execute(
            "SELECT term, kind FROM entries WHERE id=?", (eid,)).fetchone()
        snip = db.execute(
            "SELECT substr(body,1,180) FROM entries WHERE id=?", (eid,)).fetchone()[0]
        print(f"{score:.3f} [{kind}] {term}\n   {snip}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join(r"I:\tools\pre_embedding_filter",
                                                 "fact_store.sqlite3"))
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=5)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--query")
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()
    if args.query:
        query(args.db, args.query, args.k)
    else:
        build(args.db, args.limit, args.workers, args.batch)


if __name__ == "__main__":
    main()
