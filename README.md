# Cloud Workspace — Standalone Deploy Package

> Cross-machine workspace sync via Cloudflare Workers + D1.
> Lossless state bundle: files + variables + decisions + next_steps.

---

## What's Inside

```
cloud-workspace/
├── src/
│   ├── index.ts                 ← Cloudflare Worker (main entry)
│   ├── workspace_handlers.ts    ← CRUD + checkpoint + lease logic
│   └── workspace_html.ts        ← Dashboard & Editor HTML
├── scripts/
│   └── ws_sync.py               ← CLI: push/pull/diff/checkpoint
├── workspace_schema.sql         ← D1 schema (3 tables)
├── wrangler.toml                ← Cloudflare deploy config
├── .dev.vars.example            ← Template for local dev secrets
└── docs/
    ├── DEPLOY_CHECKLIST.md      ← Step-by-step deploy guide
    ├── QUICKSTART.md            ← 5-minute getting started
    └── AI_HANDOFF_SUMMARY.md    ← Architecture overview
```

---

## Quick Deploy (1 command)



Or manual:

### 1. Create D1 Database

```bash
npx wrangler d1 create cloud-memory-db
# → Copy the database_id into wrangler.toml
```

### 2. Apply Schema

```bash
npx wrangler d1 execute cloud-memory-db --remote --file ./workspace_schema.sql
```

### 3. Set API Key (REQUIRED)

```bash
npx wrangler secret put API_KEY
# → Enter a strong secret key when prompted
# → Keep this key safe — you'll need it for CLI and dashboard
```

### 4. Deploy

```bash
npx wrangler deploy
```

### 5. Verify

```bash
# Pool status
curl https://YOUR-WORKER.workers.dev/workspace/pool-status

# Dashboard (browser)
open https://YOUR-WORKER.workers.dev/workspace
```

---

## Security Setup (Recommended)

### API Key

The `API_KEY` is required for all write operations. Set it as a Cloudflare Worker secret:

```bash
npx wrangler secret put API_KEY
# Enter a strong, random string (e.g., use openssl rand -hex 32)
```

### CORS Whitelist (Optional)

Restrict which domains can access your API:

```bash
npx wrangler secret put ALLOWED_ORIGINS
# Enter: https://your-app.com,http://localhost:3000
```

If not set, all origins are allowed (dev mode).

### Rate Limiting (Optional)

Limit requests per IP to prevent abuse:

```bash
npx wrangler secret put RATE_LIMIT_PER_MIN
# Enter: 60
```

Default is 60 requests/minute/IP. Set to 0 to disable.

### Local Development

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your API key
npx wrangler dev
```

---

## All Commands



## CLI Usage

```bash
# Set API key
export CF_MEMORY_KEY="your-api-key"

# Create workspace
python scripts/ws_sync.py create "my-project" ./my-project

# Push changes
python scripts/ws_sync.py push ./my-project

# Pull on another machine
python scripts/ws_sync.py pull <workspace-id> ./my-project

# Diff local vs cloud
python scripts/ws_sync.py diff ./my-project

# Checkpoint
python scripts/ws_sync.py checkpoint ./my-project "Phase 1 done"
```

---

## MCP Tools (14 total)

| Tool | Description |
|------|-------------|
| `ws_create` | Create workspace with initial state |
| `ws_list` | List active/paused/archived workspaces |
| `ws_load` | Load full workspace bundle |
| `ws_update` | Merge state changes |
| `ws_checkpoint` | 4-way snapshot (pool/vault/fact/cloud) |
| `ws_archive` | Archive workspace |
| `ws_delete` | Permanently delete |
| `ws_search` | Search within workspace |
| `ws_heartbeat` | Keep workspace alive |
| `ws_claim` | Exclusive write lock |
| `ws_release` | Release write lock |
| `ws_stale_detect` | Auto-pause idle workspaces |
| `ws_pool_status` | Pool overview |
| `search_memory` | Cross-session memory search |

---

## Architecture

- **Workspace = active unit of work** (NOT passive memory)
- **Bundle = lossless state**: files + variables + decisions + next_steps
- **Write lease**: heartbeat-backed exclusive lock (10-min timeout)
- **4-way checkpoint**: pool snapshot / vault / fact extraction / cloud ref
- **Cron trigger**: auto-pause stale workspaces every 6 hours
- **Zero search needed**: workspace = loaded state, just open/close

### Security

- **API_KEY**: Required for all write operations (constant-time comparison)
- **CORS**: Configurable origin whitelist (default: all origins)
- **Rate limit**: Per-IP sliding window (default: 60 req/min)
- **Write lease**: Heartbeat-backed exclusive lock prevents concurrent writes
- **Secrets**: Stored in Cloudflare Worker secrets (never in code)

---

## Requirements

- Node.js (for wrangler)
- Python 3.8+ (for ws_sync.py)
- Cloudflare account (Workers + D1)
