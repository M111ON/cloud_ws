"""collect_hermes_db against a throwaway state.db shaped like the real one.

The real database is 800MB and live, so nothing here touches it: every case
builds a small database with the same tables and columns and points HERMES_DB at
it. What is being pinned is the resume contract, the row filter, and the fact
shape the store depends on.
"""
import os
import sqlite3
import sys
import tempfile
import time

sys.path.insert(0, ".")
import freebuff_daemon as fd     # noqa: E402
import v2 as store_v2            # noqa: E402

FAILED = []


def check(name, cond, detail=""):
    print("  %s %s%s" % ("ok  " if cond else "FAIL", name,
                         "" if cond else "  <- " + str(detail)))
    if not cond:
        FAILED.append(name)


def collect_keeps_state_pure(state):
    """run_once owns persisting the watermark, so the collector must not write
    it behind its caller's back — otherwise a dry run would move the mark."""
    before = dict(state.get("hermes_db", {}))
    fd.collect_hermes_db(state, True)
    return dict(state.get("hermes_db", {})) == before


def make_db(path, rows):
    """(Re)create the two tables the collector reads, seeded with rows."""
    d = sqlite3.connect(path)
    d.executescript("DROP TABLE IF EXISTS messages;"
                    "DROP TABLE IF EXISTS sessions;"
                    "CREATE TABLE sessions(id TEXT PRIMARY KEY, title TEXT);"
                    "CREATE TABLE messages(id INTEGER PRIMARY KEY, "
                    "session_id TEXT, role TEXT, content TEXT, "
                    "timestamp REAL);")
    seen = {}
    for r in rows:
        seen.setdefault(r[1], r[4])
    d.executemany("INSERT INTO sessions VALUES(?,?)", sorted(seen.items()))
    d.executemany("INSERT INTO messages(session_id, role, content, timestamp) "
                  "VALUES(?,?,?,?)", [(r[1], r[2], r[3], r[0]) for r in rows])
    d.commit()
    d.close()


# Fixed epoch base, not time.time() minus something: a clock-derived base makes
# the suite depend on how long the test takes to run, and the watermark
# assertions below compare against it. These values only need to be ordered,
# not close to now.
T0 = 1700000000.0
ROWS = [
    # (timestamp, session, role, content, session_title)
    (T0 + 1, "s1", "user",      "one thing that matters", "First session"),
    (T0 + 2, "s1", "assistant", "here is the answer",     "First session"),
    (T0 + 3, "s1", "tool",      '{"dump": "raw json"}',   "First session"),
    (T0 + 4, "s1", "assistant", "",                       "First session"),
    (T0 + 5, "s2", "user",      "second session question", "Second session"),
    (T0 + 6, "s2", "user",      "one thing that matters",  "Second session"),
    (T0 + 7, "s2", "user",      None,                      "Second session"),
]
tmp = tempfile.mkdtemp()
db = os.path.join(tmp, "state.db")
make_db(db, ROWS)
fd.HERMES_DB = db

print("collector on a fresh db")
st = {}
facts, ts, more = fd.collect_hermes_db(st, True)
check("tool rows are excluded", all("raw json" not in f["content"]
                                    for f in facts))
check("empty and null content dropped",
      len(facts) == 4, [f["content"][:40] for f in facts])
check("more=False when under the segment", more is False)
check("source_file is per session",
      {f["source_file"] for f in facts} == {"hermesdb:s1", "hermesdb:s2"},
      {f["source_file"] for f in facts})
check("term_hint carries the session title",
      {f["term_hint"] for f in facts} == {"First session", "Second session"},
      {f["term_hint"] for f in facts})
check("session id is in the content",
      all(f["content"].startswith("[s") for f in facts))
check("fact keys match the chat path",
      all(set(f) == {"content", "source_file", "pattern", "kind", "term_hint"}
          for f in facts))

print("\nwatermark resume")
check("ts is the newest row read", ts == T0 + 6, ts)
# The collector returns the new watermark; run_once is what persists it, so the
# test has to do the same or the second pass re-reads from the old value.
st = {"hermes_db": {"ts": ts}}
facts2, ts2, _ = fd.collect_hermes_db(st, True)
check("second pass reads nothing new", facts2 == [] and ts2 == ts,
      (len(facts2), ts2))
check("state dict itself is not mutated by the collector",
      collect_keeps_state_pure(st))

print("\nnew rows appear after the watermark")
make_db(db, [(ts + 5, "s3", "user", "arrived later", "Third session")])
st2 = {"hermes_db": {"ts": ts}}
f3, ts3, _ = fd.collect_hermes_db(st2, True)
check("only the new row is read",
      len(f3) == 1 and "arrived later" in f3[0]["content"],
      [f["content"][:50] for f in f3])

print("\nrepeated messages collapse by content hash")
dupes = [(ts + 10 + i, "s4", "user", "same words", "Fourth session")
         for i in range(5)]
make_db(db, dupes)
st3 = {"hermes_db": {"ts": ts}}
f4, _, _ = fd.collect_hermes_db(st3, True)
ids = {store_v2.eid(x["source_file"], x["content"].strip()) for x in f4}
check("5 identical turns are one fact", len(ids) == 1, len(ids))
check("but all 5 rows were read", len(f4) == 5, len(f4))

print("\nsegment cap")
make_db(db, [(ts + 100 + i, "s5", "user", "msg %d" % i, "Fifth")
             for i in range(50)])
st4 = {"hermes_db": {"ts": ts}}
f5, ts5, more5 = fd.collect_hermes_db(st4, True, limit=10)
check("limit respected", len(f5) == 10, len(f5))
check("more=True when rows remain", more5 is True)
seen, passes = 0, 0
while passes < 20:
    fx, tsx, mx = fd.collect_hermes_db(st4, True, limit=10)
    seen += len(fx)
    st4["hermes_db"]["ts"] = tsx          # what run_once does
    passes += 1
    if not mx:
        break
check("repeated passes drain the backlog", seen == 50 and passes == 5,
      (seen, passes))

print("\nmissing database is not a crash")
saved = fd.HERMES_DB
fd.HERMES_DB = os.path.join(tmp, "nope.db")
f6, ts6, m6 = fd.collect_hermes_db({}, True)
check("returns empty and keeps the watermark", f6 == [] and m6 is False)
fd.HERMES_DB = saved

print("\n%s" % ("ALL PASS" if not FAILED else "FAILED: %s" % FAILED))
sys.exit(1 if FAILED else 0)
