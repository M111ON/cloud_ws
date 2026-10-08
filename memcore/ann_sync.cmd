@echo off
REM ann_sync.cmd — keep the ANN index (:8096) in step with the memcore store.
REM Safe to run any time; it no-ops when the store has not moved.
REM Run by the `ann-sync` scheduled task, or double-click to sync now.
"I:\tools\obsidian-memory\.venv\Scripts\python.exe" "I:\tools\cloud_ws\memcore\ann_sync.py" %*
echo exit=%ERRORLEVEL%
