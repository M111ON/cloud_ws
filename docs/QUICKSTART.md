# Workspace Quick Start

> 5 minutes from zero to working workspace.

---

## 1. Setup

```bash
cd cloud-memory/scripts
export CF_MEMORY_KEY="your-api-key"   # or create .api_key file
```

## 2. Create Your First Workspace

```bash
python ws_sync.py create "my-project" ./my-project
# ✓ Created workspace 'my-project' (id: ws-xxxx)
# Pulling workspace ws-xxxx → ./my-project/
```

## 3. Add Files

```bash
echo "# My Project" > ./my-project/README.md
echo '{"version": "1.0"}' > ./my-project/_variables.json
echo "Use TypeScript" > ./my-project/_decisions.json
echo "1. Build tests" > ./my-project/_next_steps.md
echo "Working on API integration" > ./my-project/_context.md
```

## 4. Push to Cloud

```bash
python ws_sync.py push ./my-project
# ✓ Pushed to workspace 'my-project'
#    Files: 1, Variables: 1, Decisions: 1, Next steps: 1
```

## 5. Verify

```bash
python ws_sync.py list
# ID                           Name                      Files  Vars  Steps
# ws-xxxx                      my-project                  1     1      1
```

## 6. Pull on Another Machine

```bash
# Machine B:
python ws_sync.py pull ws-xxxx ./my-project
# ✓ Pulled workspace 'my-project' to ./my-project/
```

## 7. Search Within Workspace

```bash
python ws_sync.py search ws-xxxx "TypeScript"
# [decision] dec_001
#   **TypeScript**
```

## 8. Checkpoint

```bash
python ws_sync.py checkpoint ./my-project "Phase 1 complete"
# ✓ Checkpoint #1 created
#    Facts extracted → searchable via search_memory
```

---

## File Conventions

| File | Purpose |
|------|---------|
| `README.md` | Main file (auto-synced) |
| `_variables.json` | Key-value state |
| `_decisions.json` | Decisions with IDs |
| `_next_steps.md` | Ordered next steps |
| `_context.md` | General context |
| `.ws-manifest.json` | Workspace metadata (auto-managed) |

---

## Common Commands

```bash
# Status
ws_sync.py status                  # pool overview
ws_sync.py list                    # list workspaces

# Sync
ws_sync.py push ./dir              # save to cloud
ws_sync.py pull <id> ./dir         # load from cloud
ws_sync.py diff ./dir              # compare local vs cloud

# Lifecycle
ws_sync.py heartbeat ./dir         # keep alive
ws_sync.py claim ./dir             # exclusive access
ws_sync.py release ./dir           # release access

# Cleanup
ws_sync.py checkpoint ./dir        # snapshot + extract facts
ws_sync.py delete <id>             # permanent delete
```

---

## Browser

- **Dashboard:** https://cloud-memory-worker.aexid03.workers.dev/workspace
- **Editor:** https://cloud-memory-worker.aexid03.workers.dev/workspace/editor
- **Memory Search:** https://cloud-memory-worker.aexid03.workers.dev/

Write actions in Dashboard/Editor prompt for the API key once and store it in
browser `localStorage` as `CF_MEMORY_KEY`.
