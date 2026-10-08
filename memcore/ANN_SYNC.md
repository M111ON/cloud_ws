# ANN_SYNC.md — keep the ANN index (:8096) in step with the memcore store

## ปัญหา

`memory_daemon.py` embed แชท/แฟกต์ใหม่ลง
`I:\tools\cloud_ws\memcore\fact_store.v2.sqlite3` — **จบแค่นั้น**
แต่ ANN server `:8096` ไม่ได้อ่าน store ตรง ๆ มันเสิร์ฟ index ที่ *derive* มา:

```
fact_store.v2.sqlite3  ──build_index.py──▶  I:\tools\ann\data\memcore\kv_index.jsonl
                       ──POST /v1/state/regrow──▶  (เทรน anchor + เขียน .order/.bin)
```

ไม่มีอะไร rebuild index ให้เอง → daemon โตขึ้นเรื่อย ๆ แต่ `:8096` ค้างที่
วันที่สร้างครั้งสุดท้าย (ของเดิมสร้าง 2026-10-08 ทั้งคู่ 57076 แถว แต่ไม่มีตัวตามต่อ)

## ทางแก้: `ann_sync.py` (แยกจาก daemon — ไม่แตะ `memory_daemon.py`)

```
python ann_sync.py            # sync ถ้า store ขยับ, ไม่งั้น no-op ~1s
python ann_sync.py --dry-run  # โชว์แผน ไม่เขียนอะไร
python ann_sync.py --force    # rebuild แม้ signature ตรง
python ann_sync.py --adopt    # ตั้ง store ปัจจุบันเป็น "synced แล้ว" (ครั้งเดียว)
python ann_sync.py --no-regrow# base index only (ไม่ POST)
```

ลำดับงาน:

1. signature store = `entries:embeddings:max(rowid)` (daemon INSERT อย่างเดียว → เลขนี้เปลี่ยน iff มีของใหม่)
2. signature ตรงกับที่ sync ไว้ → `exit 0` ทันที
3. `python I:\tools\ann\scripts\build_index.py --db <store> --out <index>`
4. `POST http://127.0.0.1:8096/v1/state/regrow` (เทรน anchor, ~70s บน 57k)
5. บันทึก signature ลง `.ann_sync_state.json`

## Automation: task `ann-sync`

```sh
memcore\install_ann_sync_task.cmd 15   # สร้าง task ทุก 15 นาที
schtasks /run /tn ann-sync             # สั่งรันทันที
```

แยกจาก task `memory-daemon` โดยสิ้นเชิง — `memory_daemon.py` ไม่ถูกแก้
(ตอนติดตั้งจริง task นี้ตั้งเป็น **15 นาที**; task `memory-daemon` ยัง **Disabled** อยู่ตามเดิม)

## กันพลาด (มี test แล้ว)

- **refuse on mismatch**: ถ้า server เสิร์ฟ index คนละไฟล์กับที่เราสร้าง → ไม่ POST (rc 5)
- **disk floor**: เหลือ < `ANN_SYNC_MIN_FREE_MB` (default 600) → ไม่เขียน (rc 3)
  (สำคัญ: I: เต็ม 99%; build เขียน ~235MB + regrow เขียน .tmp อีกก้อน)
- **single-instance**: `.ann_sync.lock` เก็บ PID; PID ตายแล้ว reclaim ได้
- **atomic**: build_index เขียน tmp+rename, regrow ก็เขียนทับแบบ atomic → server ที่รันอยู่ไม่เคยอ่านครึ่งทาง

## env knobs

| var | default | ความหมาย |
|---|---|---|
| `MEMCORE_STORE_DB` | `memcore\fact_store.v2.sqlite3` | store ต้นทาง |
| `ANN_ROOT` | `I:\tools\ann` | ที่อยู่ repo ann |
| `ANN_INDEX_OUT` | `<ANN_ROOT>\data\memcore\kv_index.jsonl` | index ปลายทาง |
| `MEMCORE_ANN_URL` | `http://127.0.0.1:8096` | base URL ของ ANN server |
| `ANN_SYNC_MIN_FREE_MB` | `600` | เพดานกันดิสก์เต็ม |

## กับดักที่เจอตอนทำ (อย่าขุดซ้ำ)

1. **path ต้องเป็น Windows path** — `build_index.py` เป็น Python (Windows);
   ส่ง `I:\tmp\...` เท่านั้น ถ้าส่ง `/i/tmp/...` มันจะไปสร้างที่ `I:\i\tmp\...`
2. **`/health` ของ ANN ช้าได้ >10s** หลัง regrow (มัน probe embed sidecar ทุกครั้ง)
   → สคริปต์แยก "busy" (port เปิด) ออกจาก "down" (port ปิด) ด้วย TCP connect ตรง ๆ
   ไม่งั้น false-negative ว่า server ล่มแล้วข้าม regrow
3. **rebuild ให้ผล byte-identical กับของ production** — ยืนยันแล้วทั้ง
   `kv_anchors.bin`, `kv_index.order`, `kv_index.jsonl` (57076) จึงใช้แทนกันได้
4. **task ที่รันด้วย pythonw** ไม่มี console — schtasks บางคำสั่งถาม run-as ผ่าน
   stdin จนชน timeout (บทเรียนเดียวกับ tray) ถ้าจะ debug ให้รัน `ann_sync.cmd` ดู log

## receipts (2026-10-08)

- E2E บน instance แยก (:8098 tiny 41 แถว / :8099 57k): build → regrow → no-op ผ่าน
- drift จริง: store 57076 → 57077 → task ตรวจเจอ → build 31.6s → regrow → `:8096` = 57077
  → แถว probe ค้นเจอ top-1 (0.9645) → ลบ probe → sync กลับ 57076
- guard: mismatch rc=5, disk rc=3, live-pid lock refuse, stale lock reclaim — ผ่านหมด
