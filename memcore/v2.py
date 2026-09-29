#!/usr/bin/env python3
"""
v2.py — new memcore store: local embed (e5-small int8 ONNX, no API) + query.

Separate file from v1 (fact_store.sqlite3, nemotron/NIM vectors) — never mixed:
different model + different dim. Switch with --store v1|v2.

Usage:
    python v2.py embed [--facts path] [--db path] [--limit N] [--batch 32]
    python v2.py query "..." [--k 5] [--store v2|v1]
    # v1 path delegates to query.py (needs NVIDIA_API_KEY + network)

Embed protocol: passages prefixed "passage: ", queries "query: " (e5 requirement).
Vectors: mean-pool + L2 norm, stored f32le dim 384.
Checkpoint-safe: content-hash ids already present are skipped.
"""
import argparse
import hashlib
import json
import sqlite3
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
MODEL_DIR = r"I:\cortexkit\magic-context\models\Xenova\multilingual-e5-small"
DEFAULT_DB = str(HERE / "fact_store.v2.sqlite3")
DIM = 384

SCHEMA = """
CREATE TABLE IF NOT EXISTS entries(
  id TEXT PRIMARY KEY, source_file TEXT, pattern TEXT,
  term_hint TEXT, kind TEXT, content TEXT);
CREATE TABLE IF NOT EXISTS embeddings(entry_id TEXT PRIMARY KEY, dim INT, vec BLOB);
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(content, content='entries', content_rowid='rowid');
"""


def eid(source, content):
    return hashlib.sha256(f"{source}\0{content}".encode("utf-8")).hexdigest()[:32]


class LocalEmbed:
    def __init__(self):
        from tokenizers import Tokenizer
        import onnxruntime as ort
        self.tok = Tokenizer.from_file(MODEL_DIR + r"\tokenizer.json")
        self.tok.enable_padding()
        self.tok.enable_truncation(max_length=512)
        self.sess = ort.InferenceSession(
            MODEL_DIR + r"\onnx\model_int8.onnx",
            providers=["CPUExecutionProvider"])

    def run(self, texts):
        import numpy as np
        encs = self.tok.encode_batch(list(texts))
        ids = np.array([e.ids for e in encs], dtype=np.int64)
        mask = np.array([e.attention_mask for e in encs], dtype=np.int64)
        out = self.sess.run(None, {
            "input_ids": ids,
            "attention_mask": mask,
            "token_type_ids": np.zeros_like(ids)})[0]
        m = mask[..., None]
        v = (out * m).sum(1) / m.sum(1)
        return v / np.linalg.norm(v, axis=1, keepdims=True)


_EMB = None


def _emb():
    global _EMB
    if _EMB is None:
        _EMB = LocalEmbed()
    return _EMB


_RM = {}  # db_path -> (data_version, rows, mat) — fetch was 187ms/query


def _rows_mat(db, db_path):
    import numpy as np
    ver = db.execute("PRAGMA data_version").fetchone()[0]
    hit = _RM.get(db_path)
    if hit and hit[0] == ver:
        return hit[1], hit[2]
    rows = db.execute(
        "SELECT e.id, e.term_hint, e.kind, e.content, m.vec FROM entries e "
        "JOIN embeddings m ON m.entry_id = e.id").fetchall()
    mat = np.stack([np.frombuffer(v, dtype=np.float32) for _, _, _, _, v in rows])
    _RM[db_path] = (ver, rows, mat)
    return rows, mat


def cmd_embed(facts_path, db_path, limit, batch):
    import numpy as np
    db = sqlite3.connect(db_path)
    db.executescript(SCHEMA)
    have = {r[0] for r in db.execute("SELECT id FROM entries")}
    rows = []
    with open(facts_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            content = (d.get("content") or "").strip()
            if not content:
                continue
            i = eid(d.get("source_file", ""), content)
            if i in have:
                continue
            rows.append((i, d.get("source_file", ""), d.get("pattern", ""),
                         d.get("term_hint", ""), d.get("kind", ""), content))
            if limit and len(rows) >= limit:
                break
    print(f"new rows: {len(rows)}", flush=True)
    if not rows:
        return
    enc = _emb()
    done = 0
    for s in range(0, len(rows), batch):
        chunk = rows[s:s + batch]
        vecs = enc.run(["passage: " + c[5][:6000] for c in chunk])
        db.executemany("INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?)", chunk)
        db.executemany(
            "INSERT OR REPLACE INTO embeddings VALUES(?,?,?)",
            [(c[0], DIM, v.astype(np.float32).tobytes())
             for c, v in zip(chunk, vecs)])
        db.commit()
        done += len(chunk)
        print(f"  embedded {done}/{len(rows)}", flush=True)
    db.execute("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
    db.commit()
    print(f"done: {done} -> {db_path}", flush=True)


def search(db_path, q, k=5):
    """Hybrid-ish search for the MCP server: vector cosine + FTS RRF.
    Returns [{term, kind, n_sources, body, score}] — same shape as v1 query.search."""
    import numpy as np
    db = sqlite3.connect(db_path)
    try:
        rows, mat = _rows_mat(db, db_path)
    except sqlite3.OperationalError:
        return []
    if not rows:
        return []
    enc = _emb()
    qv = enc.run(["query: " + q])[0]
    sims = mat @ qv
    order = np.argsort(sims)[::-1][: 2 * k]
    vrank = {int(i): r for r, i in enumerate(order)}
    # AND first (precise); fall back to OR when mixed Thai/EN yields 0 hits.
    # ORDER BY bm25 rank — rowid order made FTS ranks meaningless.
    match = " ".join(f'"{w}"' for w in q.split()[:10])
    try:
        fts = [r[0] for r in db.execute(
            "SELECT rowid FROM entries_fts WHERE entries_fts MATCH ? "
            "ORDER BY rank LIMIT ?", (match, 2 * k))]
        if not fts:
            fts = [r[0] for r in db.execute(
                "SELECT rowid FROM entries_fts WHERE entries_fts MATCH ? "
                "ORDER BY rank LIMIT ?", (" OR ".join(f'"{w}"' for w in q.split()[:10]), 2 * k))]
    except sqlite3.OperationalError:
        fts = []
    id_by_rowid = [r[0] for r in db.execute("SELECT id FROM entries")]
    scores = {}
    for i, r in vrank.items():
        scores[rows[i][0]] = scores.get(rows[i][0], 0) + 1.0 / (60 + r)
    for r, rowid in enumerate(fts):
        if 1 <= rowid <= len(id_by_rowid):
            eid_ = id_by_rowid[rowid - 1]
            scores[eid_] = scores.get(eid_, 0) + 1.0 / (60 + r)
    by_id = {rid: (hint, kind, content, float(sims[idx]))
             for idx, (rid, hint, kind, content, _) in enumerate(rows)}
    out = []
    for eid_, sc in sorted(scores.items(), key=lambda x: -x[1])[:k]:
        hint, kind, content, vsim = by_id[eid_]
        out.append({"term": hint or eid_[:8], "kind": kind,
                    "n_sources": 1, "body": content[:1200], "score": round(sc, 4)})
    return out


def cmd_query(q, k, store):
    if store == "v1":
        r = subprocess.run(
            [sys.executable, str(HERE / "query.py"), q, "--k", str(k)],
            capture_output=True, text=True)
        print(r.stdout, end="")
        return
    import numpy as np
    db = sqlite3.connect(DEFAULT_DB)
    try:
        rows = db.execute(
            "SELECT e.id, e.term_hint, e.kind, e.content, m.vec FROM entries e "
            "JOIN embeddings m ON m.entry_id = e.id").fetchall()
    except sqlite3.OperationalError as e:
        print(f"v2 store not built yet ({e}). Run: python v2.py embed")
        return
    if not rows:
        print("v2 store empty. Run: python v2.py embed")
        return
    enc = _emb()
    qv = enc.run(["query: " + q])[0]
    mat = np.stack([np.frombuffer(v, dtype=np.float32) for _, _, _, _, v in rows])
    sims = mat @ qv
    top = np.argsort(sims)[::-1][:k]
    for rank, i in enumerate(top, 1):
        rid, hint, kind, content, _ = rows[i]
        print(f"[{rank}] {sims[i]:.4f} {kind}/{hint} ({rid[:8]})")
        print(f"     {content[:400]}")
        print()


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("embed")
    e.add_argument("--facts", default=r"I:\tools\pre_embedding_filter\facts.jsonl")
    e.add_argument("--db", default=DEFAULT_DB)
    e.add_argument("--limit", type=int, default=0)
    e.add_argument("--batch", type=int, default=32)
    q = sub.add_parser("query")
    q.add_argument("q")
    q.add_argument("--k", type=int, default=5)
    q.add_argument("--store", choices=["v2", "v1"], default="v2")
    a = ap.parse_args()
    if a.cmd == "embed":
        cmd_embed(a.facts, a.db, a.limit, a.batch)
    else:
        cmd_query(a.q, a.k, a.store)


if __name__ == "__main__":
    main()
