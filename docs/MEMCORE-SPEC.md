# memcore — Personal Memory Engine Spec

> **Vision:** "inference engine ของตัวตน" — แพ็กความรู้/วิธีทำงานของเจ้าของ
> เป็น corpus ไฟล์เดียว (เหมือน .gguf ของสมอง) พกไป device/platform ไหนก็ได้
> AI เรียกใช้ได้เหมือนกันทุกที่ ข้อมูลเป็น light private data อยู่แค่ในฐานของเรา

---

## 1. หลักคิดกลาง

- **Single truth, many views** — SQLite / Cloudflare / Obsidian / JSONL
  ไม่ใช่ copy หลายชุด แต่เป็น "ภาษา" (view/projection) ต่างกันบน slot space เดียว
- **Address = truth** — fact อยู่ slot ไหน deterministic, ไม่มี hash collision,
  integrity มาจากโครงสร้าง (XOR oracle ต่อ part)
- **Feed-first** — format ต้องถูก extract จากข้อมูลจริง; pipeline ก่อน portability
- **Append-only + content-hash dedup** — sync = union by hash
  ไม่มี merge conflict; ขากลับ (new facts from remote) = append ธรรมดา

```
chat logs / notes (export .md)
    │
    ▼
pre_embedding_filter        ← GATE เดียว: parse→dedupe(fork)→classify→facts.jsonl
    │ facts.jsonl
    ▼
LLM synthesis pass          ← group by term_hint → definition per term
    │
    ▼
FACT STORE (append-only, hash-keyed)   ★ single truth
    │ serialize via twin machinery
    ▼
FACT TWIN (multi-view file) ── view:sqlite / view:obsidian.md / view:cloud(D1/KV/R2)
    │
    ▼
Retrieval + synthesis       ← local 0.5B default; cloud burst opt-in (slots only travel)
```

---

## 2. ระบบที่มีอยู่แล้ว (Inventory)

### DWGLS (I:\DWGLS-native-fs · github.com/M111ON/DWGLS feat/geo-native-fs)
**บทบาทใน memcore: storage/addressing/integrity layer**

| Component | Proven | Reuse เป็น |
|-----------|--------|-----------|
| `tools/gguf_roundtrip.c` | 8 views lossless on real GGUF 675MB (29.8s); R2 byte-identical; R3 damage localize+restore | twin serialization engine สำหรับ corpus |
| RID views ×8 (pent/tri/snubL/snubR/hosoya/zeck/pascal/hexagram) | bijection 60 slots ทั้ง 8, enantiomorph pair verified | multi-view read/write paths |
| `core/infra/dramtile_store.h` | twin persist across process destroy | slot region I/O |
| `tools/geofs_rid.c` (GeoFS) | G1-G4: summon/persist/reload/damage drill on 7.9MB | filesystem abstraction |
| `tools/kv_rid_serve.c` | checkpoint mid-gen → restore BITWISE in fresh context | state carry pattern |
| Colab pipeline (`colab-pack/deploy_llama_cuda.sh`) | prebuilt CUDA wheel ~2min; T4 bench 0.5B=141tok/s 7B=36tok/s | cloud burst compute |

### Feed gate
| Component | สถานะ |
|-----------|--------|
| `I:\tools\pre_embedding_filter` | stage 1-3 เสร็จ: parse chat .md → turn-hash dedup → classify (subagent/brainstorm/insight/embedded_doc) → facts.jsonl. stdlib-only, re-run safe |
| LLM synthesis pass | ❌ ยังไม่ทำ — ต่อจาก facts.jsonl: group by term_hint → dictionary upsert |

### Memory systems อื่น (context ประกอบ)
- vault (Obsidian) → **ย้ายไป cloud แล้ว**, local obsidian-memory index ไม่ใช่ recall layer หลัก
- session-pool / cloud-memory MCP → **parked** (ซ้อนกับ Magic Context, accuracy ไม่พอ)
- AGENTS.md convention → curated project state, agent ใหม่ productive ใน 2 นาที (OpenHuman พิสูจน์แล้ว)

---

## 3. Fact Record Schema (★ ตัดสินใจชิ้นแรก)

```jsonc
{
  "id": "blake2b16(content)",      // content-hash = address + dedup key
  "term": "kv_rid_serve",           // term_hint จาก filter
  "kind": "task_summary",           // subagent|exchange|insight|embedded_document|external_ref
  "body": "...",                    // payload text
  "ts": "2026-08-24T12:00:00Z",
  "source": "session-file.md#turn42"
}
```

Rules:
- id = content hash → append-only, sync = union by id (ฟรีจาก dedup)
- store = sqlite table keyed by id + WAL; export views อ่านจาก table เดียวกัน
- versioning: same id + different body = impossible by definition;
  corrections = new row with `supersedes: id`

## 4. Roadmap

1. **Schema + feed** — wire synthesis pass ต่อ facts.jsonl → sqlite store
   (LLM pass บน Colab หรือ local ก็ได้; upsert dictionary on term)
2. **Retrieval MVP** — retrieve by term/embedding → synthesize ด้วย Qwen2.5-0.5B
   → test queries จริง (product risk ตัวเดียวที่ยังไม่ prove: retrieval quality)
3. **Pack** — serialize store ผ่าน twin machinery (gguf_roundtrip pattern, mechanical)
4. **Sync** — union-by-hash ระหว่าง device; damage drill reuse จาก R3
5. **Views** — sqlite⇄jsonl ก่อน → obsidian.md projection → cloud D1/KV

## 5. Open Questions

- Obsidian view determinism: markdown ที่มนุษย์แก้ = non-deterministic
  → v1 ทำเป็น **read-only projection** ก่อน, two-way ค่อยว่ากัน
- Retrieval: embedding model choice (bge-m3 Thai-capable ที่ verify แล้ว vs lighter)
- Privacy boundary: local default; cloud burst ส่ง query+retrieved slots เท่านั้น
  (ไม่ใช่ corpus ทั้งก้อน) — เหมือน context window ที่เดินทาง

## 6. บันทึกการตัดสินใจ (2026-08-24)

- ทำ **feed/store ก่อน pack** — format extract จากข้อมูลจริง ไม่ใช่จินตนาการ
- ขากลับ (return trip) solve ตั้งแต่ต้นด้วย append-only + hash — ไม่ defer
- Park session-pool/cloud-memory; single-truth = fact store ที่จะสร้างใน repo นี้
- แยก repo จาก DWGLS — DWGLS เป็น library/storage layer, ไม่ผสม business logic
