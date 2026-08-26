#!/usr/bin/env python3
"""
query.py — hybrid retrieval over fact_store.sqlite3 (memcore roadmap step 2).

RRF merge: FTS5 bm25 ranks + nemotron-3-embed-1b cosine ranks
    score = sum over sources  1/(60 + rank)
Needs numpy (obsidian-memory venv has it).

Usage:
    python query.py "query" [--k 5] [--fts-weight 1] [--vec-weight 1]
"""
import base64
import argparse
import json
import os
import sqlite3
import struct
import sys
import urllib.request

import numpy as np

BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "nvidia/nemotron-3-embed-1b"
KEY_ENV = "NVIDIA_API_KEY"
MAX_CHARS = 1500


def embed(text: str) -> np.ndarray:
    key = os.environ[KEY_ENV]
    payload = json.dumps({"input": [text[:MAX_CHARS]], "model": MODEL,
                          "input_type": "query",
                          "encoding_format": "base64"}).encode()
    req = urllib.request.Request(
        BASE_URL + "/embeddings", data=payload,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode())
    raw = base64.b64decode(data["data"][0]["embedding"])
    return np.frombuffer(raw, dtype="<f4")


def fts_rank(db, q, k):
    rows = db.execute(
        """SELECT e.id FROM entries_fts f JOIN entries e ON e.rowid=f.rowid
           WHERE entries_fts MATCH ? ORDER BY bm25(entries_fts) LIMIT ?""",
        (q, k)).fetchall()
    return {r[0]: i for i, r in enumerate(rows)}


def vec_rank(db, qv, k):
    ids, mat = [], []
    for eid, vec in db.execute("SELECT entry_id, vec FROM embeddings"):
        ids.append(eid)
        mat.append(np.frombuffer(vec, dtype="<f4"))
    if not ids:
        return {}
    m = np.vstack(mat)
    qn = qv / (np.linalg.norm(qv) or 1)
    mn = m / (np.linalg.norm(m, axis=1, keepdims=True) + 1e-9)
    sims = mn @ qn
    top = np.argsort(-sims)[:k]
    return {ids[i]: rank for rank, i in enumerate(top)}


def search(db_path, q, k, wf, wv):
    db = sqlite3.connect(db_path)
    fr = fts_rank(db, q, k * 3)
    vr = vec_rank(db, embed(q), k * 3) if wv else {}
    scores = {}
    for src, weight in ((fr, wf), (vr, wv)):
        for eid, rank in src.items():
            scores[eid] = scores.get(eid, 0.0) + weight / (60 + rank)
    if not scores:
        print("(no match)")
        return []
    top = sorted(scores.items(), key=lambda x: -x[1])[:k]
    out = []
    for eid, score in top:
        row = db.execute(
            "SELECT term, kind, n_sources FROM entries WHERE id=?",
            (eid,)).fetchone()
        if not row:
            continue
        term, kind, ns = row
        body = db.execute("SELECT substr(body,1,200) FROM entries WHERE id=?",
                          (eid,)).fetchone()[0].replace("\n", " ")
        src_tag = ("F" if eid in fr else "") + ("V" if eid in vr else "")
        print(f"{score:.4f} [{src_tag}|{kind}] {term} (sources={ns})")
        print(f"   {body}")
        out.append({"id": eid, "score": score, "term": term, "kind": kind,
                    "n_sources": ns, "sources_found": src_tag, "body": body})
    db.close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("q")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--fts-weight", type=float, default=1.0)
    ap.add_argument("--vec-weight", type=float, default=1.0)
    ap.add_argument("--db", default=os.path.join(r"I:\tools\pre_embedding_filter",
                                                 "fact_store.sqlite3"))
    args = ap.parse_args()
    search(args.db, args.q, args.k, args.fts_weight, args.vec_weight)


if __name__ == "__main__":
    main()
