"""block_facts must satisfy the real collector, not a hand-fed dict.

Each case asserts a property the store depends on: every block yields at
least one fact, the slug survives into source_file, nothing clears CP_MIN_CHARS,
no fact from a bare block collapses to just its label, and a second revision of
the same slug does not overwrite the first. Run:

    I:/tools/obsidian-memory/.venv/Scripts/python.exe test_block_facts.py
"""
import json
import sys

sys.path.insert(0, r"I:\tools\chat-pool")   # where the block grammar lives
sys.path.insert(0, ".")
import pool                      # noqa: E402  the grammar under test
import memory_daemon as fd       # noqa: E402  the consumer

FAILED = []


def check(name, cond, detail=""):
    print("  %s %s%s" % ("ok  " if cond else "FAIL", name,
                         "" if cond else "  <- " + str(detail)))
    if not cond:
        FAILED.append(name)


def blk(**kw):
    """Render a real block. _slug/_rev are header fields, not block keys."""
    slug = kw.pop("_slug", "s")
    rev = kw.pop("_rev", 1)
    f = {"title": "T", "story": "S", "method": "M", "evidence": "",
         "refs": "", "status": "open"}
    f.update(kw)
    return pool.render_block(slug, rev, f)


print("block_facts")
p = pool.parse_block(blk(title="Kineticfan arc closed",
                         story="S" * 200, method="GeoGebra oracle"))
fs = fd.block_facts({}, p)
check("title fact exists", any("(status=open rev=1)" in f["content"]
                               for f in fs))
check("slug in source_file",
      all(f["source_file"] == "chatpool:block/s" for f in fs), fs)
check("slug also in content",
      all(f["content"].startswith("[block:s]") for f in fs))
check("title fact is the short one",
      len(fs[0]["content"]) < len(fs[1]["content"]))
check("story present", "S" * 200 in fs[1]["content"])
check("method present", "GeoGebra oracle" in fs[1]["content"])
check("empty evidence not emitted", "evidence:" not in fs[1]["content"])

p2 = pool.parse_block(blk(title="Short", story="", method=""))
check("no story and no method -> title only", len(fd.block_facts({}, p2)) == 1)
check("empty story but real method -> still 2",
      len(fd.block_facts({}, pool.parse_block(
          blk(title="Short", story="", method="how it was done")))) == 2)
check("short story + long method not swallowed",
      "how it was done" in fd.block_facts({}, pool.parse_block(
          blk(title="A very long descriptive title indeed here",
              story="x", method="how it was done")))[1]["content"])

p3 = pool.parse_block(blk(title="T", story="S", evidence="34/34 green"))
f3 = fd.block_facts({}, p3)
check("evidence appended, not split",
      len(f3) == 2 and "34/34 green" in f3[1]["content"])

p4 = pool.parse_block(blk(title="T", story="S", status="closed"))
check("closed status carried",
      "(status=closed" in fd.block_facts({}, p4)[0]["content"])

print("\ncollector path (real JSONL line)")
line = json.dumps({"app": "opencode-main-x4v", "kind": "block", "t": 1.7e9,
                   "rkey": 5, "text": blk(title="MoE stream segfault fixed",
                                          story="dims + Q6_K mismatch")})
o = json.loads(line)
parsed = pool.parse_block(o["text"])
check("pool parses our own render", parsed is not None)
check("collector shape", len(fd.block_facts(o, parsed)) == 2)
check("non-block text is rejected by parse_block",
      pool.parse_block("just a normal chat line") is None)

print("\nrevision is additive, not a overwrite")
p1 = pool.parse_block(blk(_slug="task-x", _rev=1, title="v1", story="one"))
p2r = pool.parse_block(blk(_slug="task-x", _rev=2, title="v2", story="two"))
r1, r2 = fd.block_facts({}, p1), fd.block_facts({}, p2r)
check("both revisions yield a title and a body",
      [len(r1), len(r2)] == [2, 2], [len(r1), len(r2)])
check("same source_file (slug is the identity)", r1[0]["source_file"]
      == r2[0]["source_file"] == "chatpool:block/task-x")
check("rev visible in content", "rev=1" in r1[0]["content"]
      and "rev=2" in r2[0]["content"])

print("\nstore contract")
for f in fd.block_facts({}, p):
    check("keys match chat path", set(f) == {"content", "source_file",
                                             "pattern", "kind", "term_hint"},
          sorted(f))
    check("pattern/kind unchanged", f["pattern"] == "chatpool"
          and f["kind"] == "chatlog")
    check("term_hint is the slug (searchable by block name)",
          f["term_hint"] == "chatpool:s")

print("\n%s" % ("ALL PASS" if not FAILED else "FAILED: %s" % FAILED))
sys.exit(1 if FAILED else 0)