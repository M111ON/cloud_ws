@echo off
REM install_ann_sync_task.cmd [minutes] — create/update schtask ann-sync
REM Keeps the ANN index (:8096) in step with the memcore store, separately
REM from the memory-daemon task (memory_daemon.py is NOT modified).
REM Cheap when idle: ann_sync.py exits in ~1s if the store has not moved.
setlocal
set MINUTES=%1
if "%MINUTES%"=="" set MINUTES=15
schtasks /create /tn ann-sync /f ^
  /tr "\"I:\tools\obsidian-memory\.venv\Scripts\pythonw.exe\" \"I:\tools\cloud_ws\memcore\ann_sync.py\"" ^
  /sc minute /mo %MINUTES% ^
  /st 00:02 /sd 01/01/2026 /ru Administrator
echo task ann-sync every %MINUTES% min installed
