# Quick Start

> 5 minutes from zero to working workspace.

---

## 1. Set API Key

```bash
export CF_MEMORY_KEY="your-api-key"   # or create .api_key file in project root
```

## 2. Create Workspace

```bash
python scripts/ws_sync.py create "my-project" ./my-project
# ✓ Created workspace 'my-project' (id: ws-xxxx)
```

## 3. Add Files & Push

```bash
echo "# My Project" > ./my-project/README.md
echo '{"version":"1.0"}' > ./my-project/_variables.json
echo "1. Build tests" > ./my-project/_next_steps.md

python scripts/ws_sync.py sync push ./my-project
# ✓ Pushed to workspace 'my-project'
```

## 4. Pull on Another Machine

```bash
python scripts/ws_sync.py sync pull ws-xxxx ./my-project
# ✓ Pulled workspace 'my-project' to ./my-project/
```

## 5. Verify

```bash
python scripts/ws_sync.py list
# ID                    Name          Files  Vars  Steps
# ws-xxxx               my-project      1     1      1
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
| `.ws-manifest.json` | Metadata (auto-managed, do not edit) |

## Browser

- **Dashboard:** `https://YOUR-WORKER.workers.dev/workspace`
- **Editor:** `https://YOUR-WORKER.workers.dev/workspace/editor`

Write actions prompt for the API key once (stored in browser `localStorage`).

---

**→ Next:** [TASKS.md](TASKS.md) for CLI reference, lifecycle, and feedback.
