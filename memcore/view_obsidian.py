#!/usr/bin/env python3
"""
view_obsidian.py — project FACT STORE -> Obsidian markdown view (step 5).

View principle (DWGLS): projection of the same slot data, not a copy that
drifts — regenerate any time, output is deterministic (sorted by term/id),
so re-running on an unchanged store is a no-op byte-wise.

Layout:
    views/obsidian/
        MEMCORE INDEX.md          — catalog (counts, A-Z term list)
        Dictionary/<term>.md      — one note per synthesized definition
            frontmatter: id / kind / sources
    Raw facts are NOT projected (noise); they stay queryable via memcore_query.

Usage:
    python view_obsidian.py [--db ...] [--out views/obsidian] [--check]
"""
import argparse
import hashlib
import os
import re
import sqlite3

BAD_FN = r'[<>:"/\\|?*]'


def slug(term: str) -> str:
    s = re.sub(r"[^A-Za-z0-9 ._\-]", "_", term.strip())[:80].strip(". ")
    return s or "_"


def build(db_path: str, out_dir: str) -> None:
    db = sqlite3.connect(db_path)
    rows = db.execute(
        """SELECT id, term, body, n_sources FROM entries
           WHERE kind='dictionary_entry' ORDER BY term COLLATE NOCASE, id"""
    ).fetchall()
    total_entries = db.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    db.close()

    os.makedirs(os.path.join(out_dir, "Dictionary"), exist_ok=True)
    written = 0
    letters = {}
    for eid, term, body, ns in rows:
        fname = f"{slug(term)}--{eid[:8]}.md"
        letter = (term[0].upper() if term[:1].isalpha() else "#")
        letters[letter] = letters.get(letter, 0) + 1
        content = (
            "---\n"
            f"id: {eid}\n"
            f"term: {term!r}\n"
            "kind: dictionary_entry\n"
            f"sources: {ns}\n"
            "projected_from: fact_store.sqlite3\n"
            "---\n\n"
            f"# {term}\n\n{body}\n"
        )
        with open(os.path.join(out_dir, "Dictionary", fname), "w",
                  encoding="utf-8", newline="\n") as f:
            f.write(content)
        written += 1

    toc_lines = [
        "# MEMCORE INDEX",
        "",
        f"- corpus entries: {total_entries}",
        f"- dictionary notes: {written}",
        "- raw facts: query via memcore_query (not projected)",
        "",
        "## Terms A-Z",
        "",
    ]
    for ltr in sorted(letters):
        toc_lines.append(f"- **{ltr}** ({letters[ltr]}): "
                         "[Dictionary](Dictionary/)")
    with open(os.path.join(out_dir, "MEMCORE INDEX.md"), "w",
              encoding="utf-8", newline="\n") as f:
        f.write("\n".join(toc_lines) + "\n")

    print(f"[ok] projected {written} dictionary notes -> {out_dir}")


def check(out_dir: str) -> None:
    h = hashlib.blake2b(digest_size=16)
    for root, _, files in os.walk(out_dir):
        for name in sorted(files):
            p = os.path.join(root, name)
            with open(p, "rb") as f:
                h.update(f.read())
    print(f"[check] view fingerprint: {h.hexdigest()}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=r"I:\tools\pre_embedding_filter\fact_store.sqlite3")
    ap.add_argument("--out", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "views", "obsidian"))
    ap.add_argument("--check", action="store_true",
                    help="fingerprint only")
    args = ap.parse_args()
    if args.check:
        check(args.out)
    else:
        build(args.db, args.out)
        check(args.out)


if __name__ == "__main__":
    main()
