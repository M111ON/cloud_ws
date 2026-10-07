#!/usr/bin/env python3
"""tray_daemon.py — tray switch for the memory daemon.

No dashboard. Start/stop, run-once, interval in minutes. Controls the
existing `memory-daemon` scheduled task; the daemon script itself
single-instances via .daemon.lock, so overlapping ticks exit cleanly.

Run with pythonw (no console). Quits from its own menu.
"""
import subprocess
import sys

TASK = "memory-daemon"
INTERVALS = (5, 15, 30, 60)


def _run(*args):
    try:
        # stdin=DEVNULL: schtasks /change ถามรหัส run-as ผ่าน stdin;
        # ใต้ pythonw (ไม่มี console) มันจะรอคำตอบจนชน timeout 60s
        # ทุกคำสั่ง แทนที่จะจบในเสี้ยววินาที
        r = subprocess.run(list(args), capture_output=True, text=True,
                           stdin=subprocess.DEVNULL, timeout=60)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except Exception as e:
        return 1, str(e)


def is_enabled():
    rc, out = _run("schtasks", "/query", "/tn", TASK, "/fo", "LIST")
    if rc != 0:
        return False
    for line in out.splitlines():
        s = line.strip().lower()
        if s.startswith("status:"):
            return "disabled" not in s
    return False


def set_enabled(on):
    rc, _ = _run("schtasks", "/change", "/tn", TASK,
                 "/enable" if on else "/disable")
    return rc == 0


def current_interval():
    rc, out = _run("schtasks", "/query", "/tn", TASK, "/xml")
    if rc != 0:
        return None
    import re
    m = re.search(r"<Interval>PT(\d+)M</", out)
    return int(m.group(1)) if m else None


def set_interval_minutes(n):
    rc, _ = _run("schtasks", "/change", "/tn", TASK, "/ri", str(int(n)))
    return rc == 0


def read_progress():
    import json
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for name in (".memory_daemon_progress.json",
                 ".freebuff_progress.json"):  # pre-rename backup
        try:
            with open(os.path.join(here, name), encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            continue
    return {}


def read_recent_embedded(n=5):
    """Last n embedded/done lines from daemon_manual.log, newest last.

    The daemon only logs counts per source (no per-item contents in normal
    runs), so the window shows the most recent passes as-is, e.g.
    "chatpool: embedded 168" / "done: 7436 new rows -> ...".
    Returns (lines, mtime_str)."""
    import os
    import time
    here = os.path.dirname(os.path.abspath(__file__))
    log = os.path.join(here, "daemon_manual.log")
    try:
        mtime = time.strftime("%H:%M %d/%m",
                              time.localtime(os.path.getmtime(log)))
    except OSError:
        return [], "?"
    try:
        with open(log, "rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - 65536))
            tail = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return [], mtime
    hits = [ln.strip() for ln in tail
            if "embedded" in ln or ln.startswith("done:")]
    return hits[-n:], mtime


def run_now():
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    log = os.path.join(here, "daemon_manual.log")
    try:
        lf = open(log, "ab", buffering=0)
        subprocess.Popen([sys.executable,
                          os.path.join(here, "memory_daemon.py"),
                          "--once"], stdout=lf, stderr=subprocess.STDOUT,
                         creationflags=0x08000000)
        return True
    except Exception:
        return False


def _tray_lock_path():
    import os
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        ".tray.lock")


def _pid_alive(pid):
    try:
        import ctypes
        # Same stale-lock lesson as memory_daemon.py: QUERY_LIMITED_INFO
        # alone can succeed on a dead PID, so confirm STILL_ACTIVE (259).
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


def _single_instance():
    import os
    lock = _tray_lock_path()
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        pass
    try:
        with open(lock, "r") as fh:
            pid = int((fh.read() or "0").strip())
    except (OSError, ValueError):
        pid = 0
    if pid and _pid_alive(pid):
        return False
    try:
        os.remove(lock)
    except OSError:
        return False
    return _single_instance()


def _release_lock():
    import os
    try:
        with open(_tray_lock_path(), "r") as fh:
            if int((fh.read() or "0").strip()) == os.getpid():
                os.remove(_tray_lock_path())
    except (OSError, ValueError):
        pass


def _make_icon(on):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, 60, 60], radius=12,
                        fill=(46, 160, 67, 255) if on else (120, 120, 120, 255))
    d.text((32, 34), "M", fill=(255, 255, 255, 255), anchor="mm")
    return img


def _refresh(icon):
    on = is_enabled()
    iv = current_interval()
    import pystray
    icon.icon = _make_icon(on)
    icon.menu = pystray.Menu(
        pystray.MenuItem(
            "daemon: %s (ทุก %s นาที)" % ("เปิด" if on else "หยุด",
                                          iv if iv else "?"),
            lambda i, it: None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("รันเดี๋ยวนี้ 1 รอบ", lambda i, it: run_now()),
        pystray.MenuItem("หยุดชั่วคราว" if on else "เริ่มต่อ",
                         lambda i, it: (_toggle(), _refresh(i))),
        pystray.MenuItem(
            "รอบ (นาที)",
            pystray.Menu(*(
                pystray.MenuItem(
                    "%d นาที%s" % (m, " ✓" if m == iv else ""),
                    lambda i, it, m=m: (set_interval_minutes(m),
                                        _refresh(i)))
                for m in INTERVALS))),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("ออก", lambda i, it: (_release_lock(),
                                                       icon.stop())),
    )


def _toggle():
    set_enabled(not is_enabled())


def _heartbeat():
    import os
    import time
    alive = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         ".tray.alive")
    while True:
        try:
            with open(alive, "w") as fh:
                fh.write("%d %d" % (os.getpid(), int(time.time())))
        except OSError:
            pass
        time.sleep(60)


def main():
    if not _single_instance():
        sys.exit(0)
    import atexit
    atexit.register(_release_lock)
    import threading
    threading.Thread(target=_heartbeat, daemon=True).start()
    import pystray
    icon = pystray.Icon("memory-daemon", _make_icon(is_enabled()),
                        "memory daemon")
    icon.menu = pystray.Menu(
        pystray.MenuItem("กำลังโหลด…", lambda i, it: None, enabled=False))
    icon.run(setup=lambda i: _refresh(i))


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "tray.log"), "a") as fh:
        fh.write("start pid=%d\n" % os.getpid())
    try:
        main()
        with open(os.path.join(here, "tray.log"), "a") as fh:
            fh.write("clean-exit (icon.run returned)\n")
    except Exception:
        import traceback
        with open(os.path.join(here, "tray.log"), "a") as fh:
            fh.write(traceback.format_exc() + "\n")
