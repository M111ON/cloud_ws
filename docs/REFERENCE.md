# Advanced Reference

> Architecture, security, MCP tools, deploy, rollback.

---

## Architecture

- **Workspace = active unit of work** (NOT passive memory)
- **Bundle = lossless state**: files + variables + decisions + next_steps
- **Write lease**: heartbeat-backed exclusive lock (10-min timeout, auto-expire)
- **4-way checkpoint**: pool / vault / fact extraction / cloud ref
- **Cron**: auto-pause stale workspaces every 6 hours

### Write-Lease Rules

- WRITE ops require a live lease; READ/CREATE never locked
- Heartbeat extends lease only for owner (no lock-jacking)
- Stale lease (>10 min idle) → any agent may take over

### Cross-Agent Handoff

- `.workspace/current` points to active workspace ID
- Any agent calls `ws_resume` at boot → full bundle loaded, no search needed

---

## Security

| Feature | Detail |
|---------|--------|
| `API_KEY` | All write ops (constant-time comparison) |
| CORS | Origin whitelist (default: all) |
| Rate limit | Per-IP sliding window (default: 60/min) |
| Write lease | Exclusive lock via heartbeat |
| Secrets | Cloudflare Worker secrets (never in code) |

Optional: `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MIN` via `wrangler secret put`.

---

## MCP Tools (25)

**Memory:** `search_memory` · `list_sources` · `memory_status` · `memory_init` · `memory_get` · `memory_remember`

**Workspace:** `ws_create` · `ws_list` · `ws_load` · `ws_update` · `ws_checkpoint` · `ws_archive` · `ws_delete` · `ws_search` · `ws_feedback` · `ws_heartbeat` · `ws_claim` · `ws_release` · `ws_stale_detect` · `ws_pool_status`

**Project:** `project_list` · `project_create` · `project_update` · `project_delete` · `ws_assign`

---

## Deploy

```bash
npx wrangler d1 execute cloud-memory-db --remote --file ./workspace_schema.sql
npx wrangler deploy
curl https://YOUR-WORKER.workers.dev/status
```

### Verify

```bash
python scripts/ws_sync.py create "test" ./test
python scripts/ws_sync.py delete <test-id>
```

### Rollback

```bash
npx wrangler rollback
# or: git checkout <commit> && npx wrangler deploy
```
