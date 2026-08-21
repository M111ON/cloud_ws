# Common Tasks

> CLI, sync, lifecycle, dashboard, and feedback.

---

## CLI (8 commands)

Set API key: `export CF_MEMORY_KEY="your-api-key"`

```bash
# Core
ws_sync.py list [--status S]              # list workspaces
ws_sync.py create <name> [dir] [--label L]# create workspace
ws_sync.py status                         # pool overview
ws_sync.py checkpoint <dir> [msg]         # snapshot + extract facts
ws_sync.py delete <id>                    # permanent delete
ws_sync.py search <id> <query> [-k N]     # search workspace state

# Sync
ws_sync.py sync push <dir>                # local → cloud
ws_sync.py sync pull <id> [dir]           # cloud → local
ws_sync.py sync diff <dir>                # compare local vs cloud

# Lifecycle
ws_sync.py lifecycle heartbeat <dir>      # keep alive
ws_sync.py lifecycle claim <dir>          # exclusive write lock
ws_sync.py lifecycle release <dir>        # release lock
ws_sync.py lifecycle stale-detect         # pause idle workspaces
```

Old flat commands (`push`, `pull`, etc.) still work with a deprecation warning.

---

## Sync Workflow

```
Machine A: create → push → checkpoint
                      ↓
Machine B:           pull → edit → push → checkpoint
                      ↓
Machine A:           pull → continue
```

**Write lease:** One writer at a time (10-min heartbeat timeout). Reads always allowed.

---

## Dashboard & Editor

| URL | Purpose |
|-----|---------|
| `/workspace` | Pool dashboard + lifecycle actions + feedback widget |
| `/workspace/editor` | Create/edit workspaces from browser |
| `/` | Memory search UI |

---

## Feedback

**Submit:**
```bash
curl -X POST https://HOST/workspace/feedback \
  -H "X-API-Key: KEY" -H "Content-Type: application/json" \
  -d '{"rating":4,"category":"usability","comment":"Works well"}'
```

**Summary:** `GET /workspace/feedback/summary?days=30` → avg rating, category breakdown, daily trend, rating distribution.

**MCP:** `ws_feedback(rating=4)` · `ws_feedback(list=true)` · `ws_feedback(summary=true)`

---

**→ Deep dive:** [REFERENCE.md](REFERENCE.md)
