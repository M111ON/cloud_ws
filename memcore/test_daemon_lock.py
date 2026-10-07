"""acquire/release_lock against a throwaway lock file.

Pins the stale-lock lesson: PID numbers get reused (dead daemon PID 15384
later matched an unrelated powershell.exe), so the lock file stores
(pid, creation-time) and ownership requires both. DAEMON_LOCK is swapped
for a tempfile for the whole run; the real .daemon.lock is never touched.
"""
import os
import sys
import tempfile

sys.path.insert(0, ".")
import memory_daemon as fd       # noqa: E402

FAILED = []
TMP = tempfile.mkdtemp(prefix="daemon-lock-")
REAL_LOCK = fd.DAEMON_LOCK
fd.DAEMON_LOCK = os.path.join(TMP, ".daemon.lock")


def check(name, cond, detail=""):
    print("  %s %s%s" % ("ok  " if cond else "FAIL", name,
                         "" if cond else "  <- " + str(detail)))
    if not cond:
        FAILED.append(name)


def clean():
    try:
        os.remove(fd.DAEMON_LOCK)
    except OSError:
        pass


# 1. fresh file: acquire writes "pid ctime", release removes it
clean()
got = fd.acquire_lock()
parts = open(fd.DAEMON_LOCK).read().split()
check("fresh acquire writes pid + creation-time",
      got and len(parts) == 2 and int(parts[0]) == os.getpid()
      and int(parts[1]) > 0, parts)
fd.release_lock()
check("release removes own lock", not os.path.exists(fd.DAEMON_LOCK))

# 2. stale pid (no such process): acquire must clear it, not refuse
clean()
open(fd.DAEMON_LOCK, "w").write("999999")
check("stale pid does not block", fd.acquire_lock() is True)
fd.release_lock()
check("stale lock gone after release",
      not os.path.exists(fd.DAEMON_LOCK))

# 3. legacy single-number file naming a dead pid: same treatment
clean()
open(fd.DAEMON_LOCK, "w").write("999998")
check("legacy stale file does not block", fd.acquire_lock() is True)
fd.release_lock()
check("legacy file gone after release",
      not os.path.exists(fd.DAEMON_LOCK))

# 4. own live lock: second acquire refuses, release clears
clean()
fd.acquire_lock()
check("second acquire on live lock refuses",
      fd.acquire_lock() is False)
fd.release_lock()
check("own release clears live lock",
      not os.path.exists(fd.DAEMON_LOCK))

# 5. legacy file naming our own live pid: refuse (pid is all we have)
clean()
open(fd.DAEMON_LOCK, "w").write(str(os.getpid()))
check("legacy file with live pid refuses (safe side)",
      fd.acquire_lock() is False)
os.remove(fd.DAEMON_LOCK)

# 6. foreign live pid: refuse and never delete someone else's lock
clean()
other = os.getpid()  # stand-in: our own pid as "someone else running"
open(fd.DAEMON_LOCK, "w").write(
    "%d %d" % (other, fd._proc_create_ns(other) or 0))
r = fd.acquire_lock()
check("foreign live lock refuses", r is False)
check("foreign lock file untouched", os.path.exists(fd.DAEMON_LOCK))
os.remove(fd.DAEMON_LOCK)

# 7. pid reuse: same pid, wrong creation-time -> stale, not live
clean()
wrong_ct = (fd._proc_create_ns(os.getpid()) or 0) + 10 ** 12
open(fd.DAEMON_LOCK, "w").write("%d %d" % (os.getpid(), wrong_ct))
check("reused pid with wrong ctime does not block",
      fd.acquire_lock() is True)
fd.release_lock()
check("reused-pid lock gone", not os.path.exists(fd.DAEMON_LOCK))

# 8. release never deletes a foreign lock
clean()
open(fd.DAEMON_LOCK, "w").write("999997 %d" % (10 ** 18))
fd.release_lock()
check("release leaves foreign lock alone",
      os.path.exists(fd.DAEMON_LOCK))
os.remove(fd.DAEMON_LOCK)

print("\n%s" % ("ALL PASS" if not FAILED else "FAILED: %s" % FAILED))
fd.DAEMON_LOCK = REAL_LOCK
sys.exit(1 if FAILED else 0)
