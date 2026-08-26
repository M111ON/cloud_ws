#!/usr/bin/env python3
"""
sync_delta.py — union-by-hash sync between fact stores (memcore step 4).

Mechanism: entries are hash-keyed (blake2b-128) and append-only, so sync =
export rows the other side lacks -> INSERT OR IGNORE. No merge conflicts.

Subcommands:
    export  --db A --since-id CURSORFILE --out delta.jsonl   # rows A has, keyed after cursor
    merge   --db B --in delta.jsonl                          # union into B
    selftest                                            # split/merge convergence proof

Delta cursor: a plain text file holding the max rowid already exported.
Rows are exported ordered by rowid; re-import is always safe (hash dedup).
"""
import argparse
import json
import os
import sqlite3

COLS = "id, term, kind, body, n_sources, origin, ts, source"


def export(db_path, cursor_file, out_path):
    db = sqlite3.connect(db_path)
    cur = 0
    if os.path.exists(cursor_file):
        cur = int(open(cursor_file).read().strip() or 0)
    rows = db.execute(
        f"SELECT rowid, {COLS} FROM entries WHERE rowid > ? ORDER BY rowid",
        (cur,)).fetchall()
    n = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for rid, *vals in rows:
            f.write(json.dumps(dict(zip(COLS.split(", "), vals)),
                               ensure_ascii=False) + "\n")
            cur = max(cur, rid)
            n += 1
    db.close()
    with open(cursor_file, "w") as f:
        f.write(str(cur))
    print(f"[ok] exported {n} rows (cursor -> {cur}) -> {out_path}")


def merge(db_path, in_path):
    db = sqlite3.connect(db_path)
    n = dup = 0
    with open(in_path, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            cur = db.execute(
                "INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?,?,?)",
                (r["id"], r["term"], r["kind"], r["body"],
                 r.get("n_sources", 0), r.get("origin", ""),
                 r.get("ts", ""), r.get("source", "")))
            if cur.rowcount:
                n += 1
            else:
                dup += 1
    db.commit()
    total = db.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    db.close()
    print(f"[ok] merged new={n} duplicate={dup} | store total: {total}")


def count(db):
    return db.execute("SELECT COUNT(*) FROM entries").fetchone()[0]


def ids(db):
    return {r[0] for r in db.execute("SELECT id FROM entries")}


def selftest():
    """Prove union-by-hash convergence: A+B disjoint halves -> exchange ->
    both sides carry identical full set."""
    src = sqlite3.connect(r"I:\tools\pre_embedding_filter\fact_store.sqlite3")
    rows = src.execute(f"SELECT {COLS} FROM entries").fetchall()
    src.close()

    for p in ("_st_a.sqlite3", "_st_b.sqlite3"):
        if os.path.exists(p):
            os.remove(p)

    def fresh(p, subset):
        d = sqlite3.connect(p)
        d.execute("""CREATE TABLE entries(
            id TEXT PRIMARY KEY, term TEXT, kind TEXT, body TEXT,
            n_sources INTEGER DEFAULT 0, origin TEXT DEFAULT '',
            ts TEXT DEFAULT '', source TEXT DEFAULT '')""")
        d.executemany(
            "INSERT INTO entries VALUES(?,?,?,?,?,?,?,?)", subset)
        d.commit()
        return d

    half = len(rows) // 2
    a = fresh("_st_a.sqlite3", rows[:half])
    b = fresh("_st_b.sqlite3", rows[half:])
    print(f"device A: {count(a)} | device B: {count(b)}")

    # A exports everything -> B merges; B exports -> A merges
    def dump(d, path):
        with open(path, "w", encoding="utf-8") as f:
            for r in d.execute(f"SELECT {COLS} FROM entries"):
                f.write(json.dumps(dict(zip(COLS.split(", "), r)),
                                   ensure_ascii=False) + "\n")

    def load(d, path):
        n = 0
        with open(path, encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                c = d.execute(
                    "INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?,?,?)",
                    (r["id"], r["term"], r["kind"], r["body"],
                     r["n_sources"], r["origin"], r["ts"], r["source"]))
                n += c.rowcount
        d.commit()
        return n

    dump(a, "_delta_a.jsonl")
    got_b = load(b, "_delta_a.jsonl")
    dump(b, "_delta_b.jsonl")
    got_a = load(a, "_delta_b.jsonl")
    ia, ib = ids(a), ids(b)
    ok = (ia == ib and len(ia) == len(rows))
    print(f"A got {got_a} new, B got {got_b} new")
    print(f"converged: A={len(ia)} B={len(ib)} target={len(rows)} "
          f"-> {'PASS' if ok else 'FAIL'}")

    a.close(); b.close()
    for p in ("_st_a.sqlite3", "_st_b.sqlite3", "_delta_a.jsonl",
              "_delta_b.jsonl"):
        if os.path.exists(p):
            os.remove(p)
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["export", "merge", "selftest"])
    ap.add_argument("--db", default=r"I:\tools\pre_embedding_filter\fact_store.sqlite3")
    ap.add_argument("--since-id", default="_sync_cursor.txt")
    ap.add_argument("--out", default="delta.jsonl")
    ap.add_argument("--in", dest="infile", default="delta.jsonl")
    args = ap.parse_args()
    if args.cmd == "export":
        export(args.db, args.since_id, args.out)
    elif args.cmd == "merge":
        merge(args.db, args.infile)
    else:
        sys_exit = selftest()
        raise SystemExit(sys_exit)


if __name__ == "__main__":
    main()
