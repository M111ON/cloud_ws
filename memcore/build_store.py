#!/usr/bin/env python3
"""
build_store.py — load dictionary.jsonl (+ optional facts.jsonl) into the
append-only hash-keyed FACT STORE (memcore roadmap step 1 -> complete).

Store layout (fact_store.sqlite3):
    entries(id PK, term, kind, body, n_sources, origin, ts, source)
    entries_fts (FTS5 over term+body)

id = blake2b-128(term + '\x00' + body)  -> append-only: re-runs are no-ops,
sync between devices = union by id.

Usage:
    python build_store.py [--dict dictionary.jsonl] [--facts facts.jsonl]
                          [--out fact_store.sqlite3]
    python build_store.py --query "tensor swap" [--k 5]   # retrieval smoke test
"""
import argparse
import hashlib
import json
import os
import sqlite3
import sys

DEFAULT_DIR = r"I:\tools\pre_embedding_filter"


def entry_id(term: str, body: str) -> str:
    return hashlib.blake2b((term + "\x00" + body).encode("utf-8"),
                           digest_size=16).hexdigest()


def open_db(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.execute("""CREATE TABLE IF NOT EXISTS entries(
        id        TEXT PRIMARY KEY,
        term      TEXT NOT NULL,
        kind      TEXT NOT NULL,
        body      TEXT NOT NULL,
        n_sources INTEGER DEFAULT 0,
        origin    TEXT DEFAULT '',
        ts        TEXT DEFAULT '',
        source    TEXT DEFAULT '')""")
    db.execute("CREATE INDEX IF NOT EXISTS idx_entries_term ON entries(term)")
    db.execute("""CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
        term, body, content='entries', content_rowid='rowid')""")
    db.execute("""CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
        INSERT INTO entries_fts(rowid, term, body) VALUES (new.rowid, new.term, new.body);
        END""")
    return db


def load_jsonl(path: str):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def build(db_path: str, dict_path: str, facts_path: str | None) -> None:
    db = open_db(db_path)
    n_def = n_fact = skip = 0

    if os.path.exists(dict_path):
        for row in load_jsonl(dict_path):
            term, body = row.get("term", ""), row.get("definition", "")
            if not term or not body:
                skip += 1
                continue
            eid = entry_id(term, body)
            cur = db.execute(
                "INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?,?,?)",
                (eid, term, "dictionary_entry", body,
                 int(row.get("n_sources", 0)), row.get("origin", "llm"),
                 "", "synth_state"))
            n_def += cur.rowcount
    else:
        print(f"[warn] no dictionary at {dict_path}")

    if facts_path and os.path.exists(facts_path):
        for row in load_jsonl(facts_path):
            body = (row.get("content") or "").strip()
            if not body:
                skip += 1
                continue
            term = row.get("term_hint", "") or ""
            eid = entry_id(term, body)
            cur = db.execute(
                "INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?,?,?)",
                (eid, term, row.get("kind", "exchange"), body, 0,
                 "raw", "", row.get("source_file", "")))
            n_fact += cur.rowcount
    print(f"[ok] inserted definitions={n_def} facts={n_fact} skipped={skip}")
    total = db.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    print(f"[ok] store total: {total} entries -> {db_path}")
    db.commit()
    db.close()


def query(db_path: str, q: str, k: int) -> None:
    db = sqlite3.connect(db_path)
    rows = db.execute(
        """SELECT e.term, e.kind, e.n_sources,
                  snippet(entries_fts, 1, '>>>', '<<<', '...', 40)
           FROM entries_fts f JOIN entries e ON e.rowid = f.rowid
           WHERE entries_fts MATCH ? ORDER BY bm25(entries_fts) LIMIT ?""",
        (q, k)).fetchall()
    for i, (term, kind, ns, snip) in enumerate(rows, 1):
        print(f"{i}. [{kind}] {term} (sources={ns})")
        print(f"   {snip[:220]}")
    if not rows:
        print("(no match)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dict", default=os.path.join(DEFAULT_DIR, "dictionary.jsonl"))
    ap.add_argument("--facts", default=os.path.join(DEFAULT_DIR, "facts.jsonl"))
    ap.add_argument("--out", default=os.path.join(DEFAULT_DIR, "fact_store.sqlite3"))
    ap.add_argument("--query")
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()

    if args.query:
        query(args.out, args.query, args.k)
    else:
        build(args.out, args.dict, None if args.facts == "-" else args.facts)


if __name__ == "__main__":
    main()
