#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# setup.sh — One-command deploy for Cloud Workspace
# ═══════════════════════════════════════════════════════════════════
# Usage:
#   bash setup.sh              # full setup (interactive)
#   bash setup.sh --skip-deploy # setup without deploying
#   bash setup.sh --teardown    # remove everything
#
# Prerequisites:
#   - Node.js 18+
#   - npm install -g wrangler
#   - wrangler login (authenticated)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC}  $*"; }
fail()  { echo -e "${RED}❌${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}═══ $* ═══${NC}"; }

# ─── Parse args ──────────────────────────────────────────────────
SKIP_DEPLOY=false
TEARDOWN=false
for arg in "$@"; do
  case $arg in
    --skip-deploy) SKIP_DEPLOY=true ;;
    --teardown)    TEARDOWN=true ;;
    --help|-h)
      echo "Usage: bash setup.sh [--skip-deploy] [--teardown]"
      echo "  --skip-deploy   Setup DB + secrets but don't deploy"
      echo "  --teardown      Delete D1 database and worker"
      exit 0
      ;;
  esac
done

# ─── Preflight checks ───────────────────────────────────────────
step "Step 0: Preflight checks"

# Check Node.js
command -v node >/dev/null 2>&1 || fail "Node.js not found. Install from https://nodejs.org"
info "Node.js $(node --version)"

# Check wrangler
command -v wrangler >/dev/null 2>&1 || {
  info "Installing wrangler..."
  npm install -g wrangler
}
info "Wrangler $(wrangler --version 2>/dev/null || echo 'installed')"

# Check auth
wrangler whoami >/dev/null 2>&1 || fail "Not logged in. Run: wrangler login"
ok "Authenticated to Cloudflare"

# ─── Teardown mode ───────────────────────────────────────────────
if [ "$TEARDOWN" = true ]; then
  step "TEARDOWN: Removing all resources"
  warn "This will delete your D1 database and worker!"
  read -p "Type 'DELETE' to confirm: " confirm
  [ "$confirm" = "DELETE" ] || fail "Aborted"

  info "Deleting worker..."
  wrangler delete cloud-memory-worker 2>/dev/null || true
  ok "Worker deleted"

  info "To delete D1 database, run:"
  echo "  wrangler d1 delete cloud-memory-db"
  echo "  (or via Cloudflare Dashboard → D1)"
  exit 0
fi

# ─── Step 1: Create D1 Database ──────────────────────────────────
step "Step 1: Create D1 Database"

# Check if DB already exists
EXISTING_DB=$(wrangler d1 list 2>/dev/null | grep "cloud-memory-db" | head -1 || true)
if [ -n "$EXISTING_DB" ]; then
  warn "Database 'cloud-memory-db' already exists"
  DB_ID=$(wrangler d1 list 2>/dev/null | grep "cloud-memory-db" | awk '{print $1}' | head -1)
  info "Using existing database ID: $DB_ID"
else
  info "Creating database..."
  DB_OUTPUT=$(wrangler d1 create cloud-memory-db 2>&1)
  echo "$DB_OUTPUT"

  # Extract database ID from output
  DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "$DB_OUTPUT" | grep -oP '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)

  if [ -z "$DB_ID" ]; then
    fail "Could not extract database ID from wrangler output. Please set it manually in wrangler.toml"
  fi
  ok "Database created: $DB_ID"
fi

# Update wrangler.toml with the database ID
if [ -f "wrangler.toml" ]; then
  # Replace database_id in wrangler.toml
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/database_id = \"[^\"]*\"/database_id = \"$DB_ID\"/" wrangler.toml
  else
    sed -i "s/database_id = \"[^\"]*\"/database_id = \"$DB_ID\"/" wrangler.toml
  fi
  ok "wrangler.toml updated with database_id"
else
  fail "wrangler.toml not found"
fi

# ─── Step 2: Apply Schema ───────────────────────────────────────
step "Step 2: Apply Schema"

info "Applying workspace_schema.sql..."
wrangler d1 execute cloud-memory-db --remote --file ./workspace_schema.sql 2>&1
ok "Schema applied"

# Verify tables
info "Verifying tables..."
TABLES=$(wrangler d1 execute cloud-memory-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';" 2>&1)
echo "$TABLES" | grep -E "workspaces|workspace_state|workspace_checkpoints" && ok "All 3 tables created" || warn "Some tables may be missing"

# ─── Step 3: Set API_KEY ────────────────────────────────────────
step "Step 3: Set API_KEY"

echo ""
echo -e "${YELLOW}You need to set an API key for write operations.${NC}"
echo -e "This key is used by: CLI, dashboard, and MCP tools."
echo ""
echo -e "Tip: Generate a strong key with:"
echo -e "  ${CYAN}node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"${NC}"
echo ""

# Check if API_KEY already set
EXISTING_KEY=$(wrangler secret list 2>/dev/null | grep "API_KEY" || true)
if [ -n "$EXISTING_KEY" ]; then
  warn "API_KEY already exists"
  read -p "Do you want to update it? (y/N): " update_key
  if [ "$update_key" = "y" ] || [ "$update_key" = "Y" ]; then
    info "Setting new API_KEY..."
    wrangler secret put API_KEY
    ok "API_KEY updated"
  else
    info "Keeping existing API_KEY"
  fi
else
  info "Setting API_KEY..."
  wrangler secret put API_KEY
  ok "API_KEY set"
fi

# ─── Step 4: Set Optional Secrets ───────────────────────────────
step "Step 4: Optional Security Settings"

echo ""
read -p "Set CORS whitelist (ALLOWED_ORIGINS)? (y/N): " set_cors
if [ "$set_cors" = "y" ] || [ "$set_cors" = "Y" ]; then
  echo "Enter allowed origins (comma-separated):"
  echo "  Example: https://app.example.com,http://localhost:3000"
  wrangler secret put ALLOWED_ORIGINS
  ok "ALLOWED_ORIGINS set"
else
  info "Skipping CORS (all origins allowed)"
fi

echo ""
read -p "Set rate limit (RATE_LIMIT_PER_MIN)? (y/N): " set_rate
if [ "$set_rate" = "y" ] || [ "$set_rate" = "Y" ]; then
  echo "Enter max requests per minute per IP (default: 60):"
  wrangler secret put RATE_LIMIT_PER_MIN
  ok "RATE_LIMIT_PER_MIN set"
else
  info "Skipping rate limit (default: 60/min)"
fi

# ─── Step 5: Deploy ─────────────────────────────────────────────
if [ "$SKIP_DEPLOY" = true ]; then
  step "Step 5: Skipping deploy (--skip-deploy)"
  info "To deploy later, run: wrangler deploy"
else
  step "Step 5: Deploy"
  info "Deploying worker..."
  DEPLOY_OUTPUT=$(wrangler deploy 2>&1)
  echo "$DEPLOY_OUTPUT"

  # Extract worker URL
  WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+\.workers\.dev' | head -1 || true)
  if [ -n "$WORKER_URL" ]; then
    ok "Deployed to: $WORKER_URL"
  else
    ok "Deployed successfully"
  fi
fi

# ─── Step 6: Verify ─────────────────────────────────────────────
step "Step 6: Verify"

if [ -n "${WORKER_URL:-}" ]; then
  info "Testing pool status..."
  POOL_STATUS=$(curl -s "$WORKER_URL/workspace/pool-status" 2>/dev/null || echo '{"error": "could not connect"}')
  echo "$POOL_STATUS" | head -5

  info "Testing MCP tools list..."
  curl -s -X POST "$WORKER_URL/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"setup-test","version":"1.0.0"}}}' \
    2>/dev/null | head -3

  echo ""
  ok "Setup complete!"
  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Cloud Workspace is ready!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Dashboard:  ${CYAN}$WORKER_URL/workspace${NC}"
  echo -e "  Editor:     ${CYAN}$WORKER_URL/workspace/editor${NC}"
  echo -e "  API:        ${CYAN}$WORKER_URL/mcp${NC}"
  echo ""
  echo -e "  CLI setup:"
  echo -e "    ${YELLOW}export CF_MEMORY_KEY=\"your-api-key\"${NC}"
  echo -e "    ${YELLOW}python scripts/ws_sync.py list${NC}"
  echo ""
else
  ok "Setup complete! Run 'wrangler deploy' when ready."
fi
