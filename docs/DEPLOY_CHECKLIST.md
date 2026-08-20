# Workspace Deployment Checklist

## Pre-Deploy

- [ ] Wrangler installed: `npx wrangler --version`
- [ ] Logged in: `npx wrangler whoami`
- [ ] D1 database exists: `npx wrangler d1 list`
- [ ] API key set: `npx wrangler secret list`

## Deploy Steps

### 1. Apply Schema Migration

```bash
cd cloud-memory
npx wrangler d1 execute cloud-memory-db --remote --file ./workspace_schema.sql
```

**Verify:**
```bash
npx wrangler d1 execute cloud-memory-db --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected tables:
- `chunks` (memory)
- `query_cache` (memory)
- `workspaces` (workspace)
- `workspace_state` (workspace)
- `workspace_checkpoints` (workspace)

### 2. Verify API Key

```bash
npx wrangler secret list
```

Should show: `API_KEY` (secret_text)

### 3. Deploy Worker

```bash
npx wrangler deploy
```

### 4. Verify Deployment

```bash
# Health check
curl https://cloud-memory-worker.aexid03.workers.dev/status

# Workspace pool status
curl https://cloud-memory-worker.aexid03.workers.dev/workspace/pool-status

# Dashboard UI
open https://cloud-memory-worker.aexid03.workers.dev/workspace
```

### 5. Test CLI

```bash
cd cloud-memory/scripts
export CF_MEMORY_KEY="your-key"

# Create test workspace
python ws_sync.py create "test-workspace" ./test-ws

# Verify
python ws_sync.py list

# Cleanup
python ws_sync.py delete <test-workspace-id>
```

### 6. Verify Cron Trigger

```bash
# Check cron is configured
cat wrangler.toml | grep -A2 "\[triggers\]"

# Should show:
# [triggers]
# crons = ["0 */6 * * *"]
```

## Post-Deploy

- [ ] Dashboard loads at `/workspace`
- [ ] Editor loads at `/workspace/editor`
- [ ] CLI can create/push/pull workspaces
- [ ] MCP tools work (search_memory, ws_create, etc.)
- [ ] Checkpoint extracts facts to memory
- [ ] Cron trigger fires every 6 hours

## Rollback

```bash
# Revert to previous version
npx wrangler rollback

# Or redeploy previous commit
git checkout <previous-commit>
npx wrangler deploy
```
