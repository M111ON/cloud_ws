# Cloud Workspace

> Cross-machine workspace sync via Cloudflare Workers + D1.
> Lossless state bundle: files + variables + decisions + next_steps.

---

## Quick Deploy

```bash
npx wrangler d1 create cloud-memory-db          # → copy database_id to wrangler.toml
npx wrangler d1 execute cloud-memory-db --remote --file ./workspace_schema.sql
npx wrangler secret put API_KEY                  # enter a strong secret
npx wrangler deploy
curl https://YOUR-WORKER.workers.dev/workspace/pool-status   # verify
```

## Quick Start (5 min)

```bash
export CF_MEMORY_KEY="your-api-key"
python scripts/ws_sync.py create "my-project" ./my-project
python scripts/ws_sync.py sync push ./my-project
python scripts/ws_sync.py list
```

**→ Full guide:** [docs/QUICKSTART.md](docs/QUICKSTART.md)

---

## Documentation

| Layer | File | For |
|-------|------|-----|
| Quick Start | [docs/QUICKSTART.md](docs/QUICKSTART.md) | First-time setup, create & sync a workspace |
| Common Tasks | [docs/TASKS.md](docs/TASKS.md) | CLI reference, sync, lifecycle, dashboard, feedback |
| Advanced | [docs/REFERENCE.md](docs/REFERENCE.md) | Architecture, security, MCP tools, deploy checklist |

## Project Structure

```
├── src/index.ts                 ← Worker (main entry + routing)
├── src/workspace_handlers.ts    ← CRUD + checkpoint + lease + feedback
├── src/workspace_html.ts        ← Dashboard & Editor UI
├── scripts/ws_sync.py           ← CLI (8 commands)
├── workspace_schema.sql         ← D1 schema
├── wrangler.toml                ← Deploy config
└── docs/                        ← Documentation (3 layers)
```

## CLI (8 commands)

```bash
ws_sync.py list                              # list workspaces
ws_sync.py create <name> [dir]               # create workspace
ws_sync.py status                            # pool overview
ws_sync.py sync push|pull|diff <dir>         # sync state
ws_sync.py lifecycle heartbeat|claim|release # lifecycle
ws_sync.py checkpoint <dir> [msg]            # snapshot
ws_sync.py delete <id>                       # permanent delete
ws_sync.py search <id> <query>               # search state
```

**→ Full reference:** [docs/TASKS.md](docs/TASKS.md)

## Requirements

- Node.js (for wrangler)
- Python 3.8+ (for ws_sync.py)
- Cloudflare account (Workers + D1)
