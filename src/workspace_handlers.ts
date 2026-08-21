/* ═══════════════════════════════════════════════════════════════════════════
 * workspace_handlers.ts — Cloud Workspace Pool
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Workspace = active unit of work (NOT passive memory).
 * Bundle = lossless state: files + variables + decisions + next_steps.
 * "loaded = knows" — no search needed, just open/close.
 *
 * 4-way checkpoint: pool / vault / fact / cloud
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface WorkspaceState {
  files: Record<string, string>;        // path → content
  variables: Record<string, string>;    // key → value
  decisions: Record<string, string>;    // id → description
  next_steps: string[];                 // ordered list
  context: string;                      // general context
}

export interface WorkspaceBundle {
  id: string;
  name: string;
  label: string | null;
  project_id: string | null;
  status: 'active' | 'paused' | 'archived';
  state: WorkspaceState;
  created_at: number;
  updated_at: number;
  last_checkpoint_at: number | null;
  file_count: number;
  variable_count: number;
  decision_count: number;
  next_step_count: number;
}

export interface WorkspaceCheckpoint {
  id: string;
  workspace_id: string;
  seq: number;
  pool_snapshot: string;   // full WorkspaceState JSON
  vault_copy: string | null;
  fact_summary: string | null;
  cloud_ref: string | null;
  checksum: string;
  created_at: number;
}

export interface Env {
  cloud_memory_db: D1Database;
  VECTORIZE: Vectorize;
  AI: Ai;
  API_KEY: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_PER_MIN?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean) : [];
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || "*";
  const allowed = parseAllowedOrigins(env);
  const finalOrigin = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": finalOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Credentials": "true",
  };
}

function corsHeadersAny(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

function checkAuth(request: Request, env: Env): boolean {
  const key = request.headers.get("X-API-Key");
  if (!key || !env.API_KEY) return false;
  if (key.length !== env.API_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ env.API_KEY.charCodeAt(i);
  return diff === 0;
}

function jsonResp(data: unknown, status = 200, request?: Request, env?: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(request && env ? corsHeaders(request, env) : corsHeadersAny()) },
  });
}

function errResp(msg: string, status = 400, request?: Request, env?: Env): Response {
  return jsonResp({ error: msg }, status, request, env);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Write-lease (concurrency guard) ──────────────────────────────────────
// Workspace state is a shared editable bundle. Concurrent writers cause
// silent lost updates, so WRITE operations (update/checkpoint) require an
// exclusive lease backed by heartbeats:
//   - READ (load/list/status)      → never locked (anyone may read anytime)
//   - CREATE (new workspace/file)  → never locked (new keys never conflict)
//   - WRITE (update/checkpoint)    → owner must hold a live lease; if another
//     agent's lease is expired (> CLAIM_TIMEOUT_MS without heartbeat) the
//     writer may take over automatically.
export const CLAIM_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

interface LeaseRow {
  claimed_by: string | null;
  claimed_at: number | null;
  heartbeat_at: number | null;
}

/**
 * Returns the workspace's current lease info (never blocks a read).
 */
async function readLease(env: Env, wsId: string): Promise<LeaseRow | null> {
  return env.cloud_memory_db
    .prepare("SELECT claimed_by, claimed_at, heartbeat_at FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first<LeaseRow>();
}

/**
 * Acquire (or refresh) the write lease for `agent`. Returns null on success,
 * or a Response to return when another agent holds a live lease.
 */
async function requireWriteLease(
  env: Env,
  wsId: string,
  agent: string,
  request: Request
): Promise<Response | null> {
  const row = await readLease(env, wsId);
  if (!row) return errResp("Workspace not found", 404, request, env);

  const now = Date.now();
  if (row.claimed_by && row.claimed_by !== agent) {
    const lastActive = row.heartbeat_at || row.claimed_at || 0;
    const idleMs = now - lastActive;
    if (idleMs < CLAIM_TIMEOUT_MS) {
      return errResp(
        `Workspace is being edited by '${row.claimed_by}' (last activity ${Math.round(idleMs / 60000)} min ago). Read-only until the ${Math.round((CLAIM_TIMEOUT_MS - idleMs) / 60000)}-min lease expires or they release.`,
        409
      );
    }
    // Expired lease → takeover
  }

  // Acquire / refresh lease atomically
  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET claimed_by = ?, claimed_at = ?, heartbeat_at = ? WHERE id = ?")
    .bind(agent, now, now, wsId)
    .run();
  return null;
}

/** Refresh the heartbeat of the current lease holder (keeps lease alive). */
async function refreshLease(env: Env, wsId: string): Promise<void> {
  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET heartbeat_at = ? WHERE id = ?")
    .bind(Date.now(), wsId)
    .run();
}

// ─── Ensure tables exist (idempotent) ─────────────────────────────────────

export async function ensureWorkspaceTables(env: Env): Promise<void> {
  await env.cloud_memory_db.prepare(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      label TEXT,
      status TEXT DEFAULT 'active',
      file_count INTEGER DEFAULT 0,
      variable_count INTEGER DEFAULT 0,
      decision_count INTEGER DEFAULT 0,
      next_step_count INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER,
      last_checkpoint_at INTEGER
    )
  `).run();

  await env.cloud_memory_db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      workspace_id TEXT NOT NULL,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER,
      PRIMARY KEY (workspace_id, category, key)
    )
  `).run();

  await env.cloud_memory_db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_checkpoints (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      pool_snapshot TEXT NOT NULL,
      vault_copy TEXT,
      fact_summary TEXT,
      cloud_ref TEXT,
      checksum TEXT NOT NULL,
      created_at INTEGER
    )
  `).run();

  // Add lifecycle columns if not exists (migration)
  try {
    await env.cloud_memory_db.prepare(`ALTER TABLE workspaces ADD COLUMN claimed_by TEXT`).run();
  } catch { /* column already exists */ }
  try {
    await env.cloud_memory_db.prepare(`ALTER TABLE workspaces ADD COLUMN claimed_at INTEGER`).run();
  } catch { /* column already exists */ }
  try {
    await env.cloud_memory_db.prepare(`ALTER TABLE workspaces ADD COLUMN heartbeat_at INTEGER`).run();
  } catch { /* column already exists */ }
  try {
    await env.cloud_memory_db.prepare(`ALTER TABLE workspaces ADD COLUMN client_key TEXT`).run();
  } catch { /* column already exists */ }

  await env.cloud_memory_db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ws_status ON workspaces(status)`
  ).run();
  await env.cloud_memory_db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ws_state_ws ON workspace_state(workspace_id)`
  ).run();
  await env.cloud_memory_db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ws_ckpt_ws ON workspace_checkpoints(workspace_id)`
  ).run();

  // Feedback table
  await env.cloud_memory_db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_feedback (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      rating INTEGER NOT NULL,
      category TEXT DEFAULT 'general',
      comment TEXT,
      agent TEXT,
      created_at INTEGER
    )
  `).run();
  await env.cloud_memory_db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_feedback_ws ON workspace_feedback(workspace_id)`
  ).run();
  await env.cloud_memory_db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_feedback_created ON workspace_feedback(created_at)`
  ).run();
}

// ─── Workspace Templates ────────────────────────────────────────────────

type TemplateName = 'blank' | 'project' | 'research' | 'meeting';

const TEMPLATES: Record<TemplateName, Partial<WorkspaceState>> = {
  blank: {},

  project: {
    variables: {
      language: '',
      framework: '',
      repository: '',
      status: 'planning',
    },
    decisions: {
      'arch-001': 'Architecture: (describe approach)',
    },
    next_steps: [
      'Define project scope and requirements',
      'Set up development environment',
      'Implement core functionality',
      'Write tests',
      'Deploy and verify',
    ],
    context: 'Project workspace — update variables and next_steps as work progresses.',
  },

  research: {
    variables: {
      topic: '',
      methodology: '',
      status: 'literature-review',
    },
    decisions: {
      'method-001': 'Methodology: (describe approach)',
    },
    next_steps: [
      'Literature review',
      'Define research questions',
      'Design methodology',
      'Collect data',
      'Analyze results',
      'Write findings',
    ],
    context: 'Research workspace — track sources, methodology, and findings.',
  },

  meeting: {
    variables: {
      date: new Date().toISOString().slice(0, 10),
      attendees: '',
      organizer: '',
    },
    decisions: {},
    next_steps: [
      'Review agenda',
      'Discuss key topics',
      'Record decisions',
      'Assign action items',
    ],
    context: 'Meeting workspace — capture decisions and action items.',
  },
};

function getTemplate(name: string | undefined): Partial<WorkspaceState> {
  if (!name || name === 'blank') return {};
  return TEMPLATES[name as TemplateName] || {};
}

// ─── Fact extraction from workspace state ────────────────────────────────

function extractFactsFromState(state: WorkspaceState, wsName: string, wsId: string): string[] {
  const facts: string[] = [];

  // Each decision is a fact
  for (const [id, desc] of Object.entries(state.decisions)) {
    facts.push(`[workspace:${wsName}] Decision: ${desc}`);
  }

  // Each next_step is a fact
  for (const step of state.next_steps) {
    facts.push(`[workspace:${wsName}] Next step: ${step}`);
  }

  // Key variables (skip internal ones)
  for (const [key, val] of Object.entries(state.variables)) {
    if (val && val.length < 500) {
      facts.push(`[workspace:${wsName}] Variable ${key} = ${val}`);
    }
  }

  // Context as a single fact
  if (state.context && state.context.trim().length > 0) {
    const ctx = state.context.trim().slice(0, 1000);
    facts.push(`[workspace:${wsName}] Context: ${ctx}`);
  }

  // File names (not contents) as facts
  const fileNames = Object.keys(state.files);
  if (fileNames.length > 0) {
    facts.push(`[workspace:${wsName}] Working on ${fileNames.length} file(s): ${fileNames.slice(0, 10).join(", ")}${fileNames.length > 10 ? ", ..." : ""}`);
  }

  return facts;
}

// ─── Load full workspace bundle from D1 ───────────────────────────────────

async function loadBundle(env: Env, wsId: string): Promise<WorkspaceBundle | null> {
  const meta = await env.cloud_memory_db
    .prepare("SELECT * FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first<any>();
  if (!meta) return null;

  const rows = await env.cloud_memory_db
    .prepare("SELECT category, key, value FROM workspace_state WHERE workspace_id = ? ORDER BY category, key")
    .bind(wsId)
    .all<{ category: string; key: string; value: string }>();

  const state: WorkspaceState = {
    files: {},
    variables: {},
    decisions: {},
    next_steps: [],
    context: "",
  };

  const nextSteps: { key: string; value: string }[] = [];

  for (const row of rows.results || []) {
    switch (row.category) {
      case "file":
        state.files[row.key] = row.value;
        break;
      case "variable":
        state.variables[row.key] = row.value;
        break;
      case "decision":
        state.decisions[row.key] = row.value;
        break;
      case "next_step":
        nextSteps.push({ key: row.key, value: row.value });
        break;
      case "context":
        state.context = row.value;
        break;
    }
  }

  state.next_steps = nextSteps
    .sort((a, b) => {
      const ai = Number(a.key.replace(/^step_/, ""));
      const bi = Number(b.key.replace(/^step_/, ""));
      return ai - bi;
    })
    .map((step) => step.value);

  return {
    id: meta.id,
    name: meta.name,
    label: meta.label,
    project_id: meta.project_id || null,
    status: meta.status,
    state,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    last_checkpoint_at: meta.last_checkpoint_at,
    file_count: meta.file_count,
    variable_count: meta.variable_count,
    decision_count: meta.decision_count,
    next_step_count: meta.next_step_count,
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * POST /workspace/create
 * Body: { name: string, label?: string, state?: Partial<WorkspaceState> }
 */
export async function handleWsCreate(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const body = await request.json<{
    name?: string;
    label?: string;
    template?: string;
    project_id?: string | null;
    state?: Partial<WorkspaceState>;
    client_key?: string;
  }>();

  const name = body.name?.trim();
  if (!name) return errResp("name is required", 400, request, env);

  // Idempotency: if a client_key is provided and a workspace with it already
  // exists (e.g. two plugin instances racing to materialize the same session),
  // return the existing workspace instead of creating a duplicate.
  const clientKey = body.client_key?.trim() || null;
  if (clientKey) {
    const existing = await env.cloud_memory_db
      .prepare("SELECT id FROM workspaces WHERE client_key = ? LIMIT 1")
      .bind(clientKey)
      .first();
    if (existing) {
      const bundle = await loadBundle(env, existing.id);
      if (bundle) return jsonResp({ ok: true, created: false, workspace: bundle });
    }
  }

  const id = generateId();
  const now = Date.now();

  // Insert workspace metadata
  await env.cloud_memory_db
    .prepare(
      `INSERT INTO workspaces (id, name, label, project_id, status, created_at, updated_at, client_key)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    )
    .bind(id, name, body.label || null, body.project_id || null, now, now, clientKey)
    .run();

  // Merge template defaults with provided state
  const template = getTemplate(body.template);
  const state: Partial<WorkspaceState> = {
    files: { ...template.files, ...body.state?.files },
    variables: { ...template.variables, ...body.state?.variables },
    decisions: { ...template.decisions, ...body.state?.decisions },
    next_steps: body.state?.next_steps || template.next_steps,
    context: body.state?.context || template.context,
  };
  const statements: D1Statement[] = [];

  if (state.files) {
    for (const [key, value] of Object.entries(state.files)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'file', ?, ?, ?)")
          .bind(id, key, value, now)
      );
    }
  }
  if (state.variables) {
    for (const [key, value] of Object.entries(state.variables)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'variable', ?, ?, ?)")
          .bind(id, key, value, now)
      );
    }
  }
  if (state.decisions) {
    for (const [key, value] of Object.entries(state.decisions)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'decision', ?, ?, ?)")
          .bind(id, key, value, now)
      );
    }
  }
  if (state.next_steps) {
    for (let i = 0; i < state.next_steps.length; i++) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'next_step', ?, ?, ?)")
          .bind(id, `step_${i}`, state.next_steps[i], now)
      );
    }
  }
  if (state.context) {
    statements.push(
      env.cloud_memory_db
        .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'context', 'context', ?, ?)")
        .bind(id, state.context, now)
    );
  }

  if (statements.length > 0) {
    await env.cloud_memory_db.batch(statements);
  }

  // Update counts
  const fileCount = state.files ? Object.keys(state.files).length : 0;
  const varCount = state.variables ? Object.keys(state.variables).length : 0;
  const decCount = state.decisions ? Object.keys(state.decisions).length : 0;
  const stepCount = state.next_steps ? state.next_steps.length : 0;

  await env.cloud_memory_db
    .prepare(
      `UPDATE workspaces SET file_count=?, variable_count=?, decision_count=?, next_step_count=? WHERE id=?`
    )
    .bind(fileCount, varCount, decCount, stepCount, id)
    .run();

  const bundle = await loadBundle(env, id);
  return jsonResp({ ok: true, workspace: bundle }, 201);
}

/**
 * GET /workspace/list
 * Query: ?status=active (default) | paused | archived | all
 */
export async function handleWsList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "active";

  let query = "SELECT * FROM workspaces";
  const params: any[] = [];

  if (status !== "all") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY updated_at DESC";

  const rows = params.length > 0
    ? await env.cloud_memory_db.prepare(query).bind(...params).all<any>()
    : await env.cloud_memory_db.prepare(query).all<any>();

  return jsonResp({
    ok: true,
    count: (rows.results || []).length,
    workspaces: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      project_id: r.project_id || null,
      status: r.status,
      file_count: r.file_count,
      variable_count: r.variable_count,
      decision_count: r.decision_count,
      next_step_count: r.next_step_count,
      created_at: r.created_at,
      updated_at: r.updated_at,
      last_checkpoint_at: r.last_checkpoint_at,
    })),
  });
}

/**
 * GET /workspace/:id
 * Load full workspace state (lossless bundle).
 */
export async function handleWsLoad(request: Request, env: Env, wsId: string): Promise<Response> {
  const bundle = await loadBundle(env, wsId);
  if (!bundle) return errResp("Workspace not found", 404, request, env);
  return jsonResp({ ok: true, workspace: bundle });
}

/**
 * POST /workspace/:id/update
 * Body: { state: Partial<WorkspaceState> }
 * Merges into existing state (upsert).
 */
export async function handleWsUpdate(request: Request, env: Env, wsId: string): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  // Verify workspace exists
  const existing = await env.cloud_memory_db
    .prepare("SELECT id FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first();
  if (!existing) return errResp("Workspace not found", 404, request, env);

  const body = await request.json<{
    state?: Partial<WorkspaceState>;
    agent?: string;
    remove?: { files?: string[]; variables?: string[]; decisions?: string[]; context?: boolean };
    name?: string;
    label?: string;
    status?: "active" | "paused";
    project_id?: string | null;
  }>();
  const state = body.state || {};

  // Write guard: require a live write lease (read-only load always allowed)
  const leaseErr = await requireWriteLease(env, wsId, body.agent || "unknown", request);
  if (leaseErr) return leaseErr;

  const now = Date.now();
  const statements: D1Statement[] = [];

  // Upsert files
  if (state.files) {
    for (const [key, value] of Object.entries(state.files)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'file', ?, ?, ?)")
          .bind(wsId, key, value, now)
      );
    }
  }

  // Upsert variables
  if (state.variables) {
    for (const [key, value] of Object.entries(state.variables)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'variable', ?, ?, ?)")
          .bind(wsId, key, value, now)
      );
    }
  }

  // Upsert decisions
  if (state.decisions) {
    for (const [key, value] of Object.entries(state.decisions)) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'decision', ?, ?, ?)")
          .bind(wsId, key, value, now)
      );
    }
  }

  // Replace next_steps (ordered list — replace all)
  if (state.next_steps !== undefined) {
    // Delete existing
    statements.push(
      env.cloud_memory_db
        .prepare("DELETE FROM workspace_state WHERE workspace_id = ? AND category = 'next_step'")
        .bind(wsId)
    );
    // Insert new
    for (let i = 0; i < state.next_steps.length; i++) {
      statements.push(
        env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'next_step', ?, ?, ?)")
          .bind(wsId, `step_${i}`, state.next_steps[i], now)
      );
    }
  }

  // Upsert context
  if (state.context !== undefined) {
    statements.push(
      env.cloud_memory_db
        .prepare("INSERT OR REPLACE INTO workspace_state (workspace_id, category, key, value, updated_at) VALUES (?, 'context', 'context', ?, ?)")
        .bind(wsId, state.context, now)
    );
  }

  // Delete state entries (remove support: { files?: string[], variables?: string[], decisions?: string[], context?: boolean })
  const remove = body.remove || {};
  if (remove.files && remove.files.length > 0) {
    for (const key of remove.files) {
      statements.push(
        env.cloud_memory_db
          .prepare("DELETE FROM workspace_state WHERE workspace_id = ? AND category = 'file' AND key = ?")
          .bind(wsId, key)
      );
    }
  }
  if (remove.variables && remove.variables.length > 0) {
    for (const key of remove.variables) {
      statements.push(
        env.cloud_memory_db
          .prepare("DELETE FROM workspace_state WHERE workspace_id = ? AND category = 'variable' AND key = ?")
          .bind(wsId, key)
      );
    }
  }
  if (remove.decisions && remove.decisions.length > 0) {
    for (const id of remove.decisions) {
      statements.push(
        env.cloud_memory_db
          .prepare("DELETE FROM workspace_state WHERE workspace_id = ? AND category = 'decision' AND key = ?")
          .bind(wsId, id)
      );
    }
  }
  if (remove.context) {
    statements.push(
      env.cloud_memory_db
        .prepare("DELETE FROM workspace_state WHERE workspace_id = ? AND category = 'context'")
        .bind(wsId)
    );
  }

  if (statements.length > 0) {
    await env.cloud_memory_db.batch(statements);
  }

  // Update workspace metadata counts
  const allState = await env.cloud_memory_db
    .prepare("SELECT category, COUNT(*) as cnt FROM workspace_state WHERE workspace_id = ? GROUP BY category")
    .bind(wsId)
    .all<{ category: string; cnt: number }>();

  const counts: Record<string, number> = {};
  for (const row of allState.results || []) {
    counts[row.category] = row.cnt;
  }

  await env.cloud_memory_db
    .prepare(
      `UPDATE workspaces SET updated_at=?, file_count=?, variable_count=?, decision_count=?, next_step_count=? WHERE id=?`
    )
    .bind(
      now,
      counts["file"] || 0,
      counts["variable"] || 0,
      counts["decision"] || 0,
      counts["next_step"] || 0,
      wsId
    )
    .run();

  // Update workspace metadata (name / label / status / project) when provided
  const metaName = body.name?.trim();
  if (metaName || body.label !== undefined || body.status || body.project_id !== undefined) {
    const meta: string[] = ["updated_at=?"];
    const vals: (string | number)[] = [now];
    if (metaName) {
      meta.push("name=?");
      vals.push(metaName);
    }
    if (body.label !== undefined) {
      meta.push("label=?");
      vals.push(body.label || null);
    }
    if (body.status) {
      meta.push("status=?", "claimed_by=NULL", "claimed_at=NULL");
      vals.push(body.status);
    }
    if (body.project_id !== undefined) {
      meta.push("project_id=?");
      vals.push(body.project_id || null);
    }
    vals.push(wsId);
    await env.cloud_memory_db.prepare(`UPDATE workspaces SET ${meta.join(", ")} WHERE id=?`).bind(...vals).run();
  }

  const bundle = await loadBundle(env, wsId);
  return jsonResp({ ok: true, workspace: bundle });
}

/**
 * POST /workspace/:id/checkpoint
 * Body: { vault_copy?: string, fact_summary?: string, cloud_ref?: string }
 *
 * Creates a 4-way checkpoint:
 *   pool  = full state snapshot (automatic)
 *   vault = persistent copy (provided by caller)
 *   fact  = extracted facts (provided by caller)
 *   cloud = external reference (provided by caller)
 */
export async function handleWsCheckpoint(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  // Load current state
  const bundle = await loadBundle(env, wsId);
  if (!bundle) return errResp("Workspace not found", 404, request, env);

  const body = await request.json<{
    vault_copy?: string;
    fact_summary?: string;
    cloud_ref?: string;
    agent?: string;
  }>();

  // Write guard: checkpoint mutates workspace (snapshot + facts) → require lease
  const leaseErr = await requireWriteLease(env, wsId, body.agent || "unknown", request);
  if (leaseErr) return leaseErr;

  // Create pool snapshot (lossless full state)
  const poolSnapshot = JSON.stringify(bundle.state);

  // Compute checksum (simple hash of snapshot)
  const checksum = await sha256Hex(poolSnapshot);

  // Get next sequence number
  const lastSeq = await env.cloud_memory_db
    .prepare("SELECT MAX(seq) as max_seq FROM workspace_checkpoints WHERE workspace_id = ?")
    .bind(wsId)
    .first<{ max_seq: number }>();
  const seq = (lastSeq?.max_seq || 0) + 1;

  const cpId = `cp-${wsId}-${seq}`;
  const now = Date.now();

  await env.cloud_memory_db
    .prepare(
      `INSERT INTO workspace_checkpoints (id, workspace_id, seq, pool_snapshot, vault_copy, fact_summary, cloud_ref, checksum, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      cpId,
      wsId,
      seq,
      poolSnapshot,
      body.vault_copy || null,
      body.fact_summary || null,
      body.cloud_ref || null,
      checksum,
      now
    )
    .run();

  // Update workspace's last_checkpoint_at
  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET last_checkpoint_at = ? WHERE id = ?")
    .bind(now, wsId)
    .run();

  // ─── Auto-extract facts → push to memory (searchable) ────────
  const facts = extractFactsFromState(bundle.state, bundle.name, wsId);
  let factsPushed = 0;
  if (facts.length > 0) {
    // Embed + store each fact individually (proven pattern from memory_remember).
    // Vectorize IDs must be ≤64 bytes — use short prefix.
    for (let i = 0; i < facts.length; i++) {
      try {
        const factId = `wsf/${wsId.slice(0,8)}/${seq}_${i}`;
        const factSource = `ws-fact/${bundle.name}/checkpoint-${seq}`;

        // Embed this fact
        const embeddingResponse: any = await env.AI.run("@cf/baai/bge-m3", { text: facts[i] });
        const vec = embeddingResponse?.data?.[0]?.embedding || embeddingResponse?.data?.[0];
        if (!Array.isArray(vec)) {
          console.error(`Fact ${i} embedding failed: no vector returned`);
          continue;
        }

        // Insert into D1 chunks
        await env.cloud_memory_db
          .prepare("INSERT OR REPLACE INTO chunks (id, source_file, chunk_index, text) VALUES (?, ?, ?, ?)")
          .bind(factId, factSource, i, facts[i])
          .run();

        // Upsert into Vectorize
        await env.VECTORIZE.upsert([{ id: factId, values: vec, namespace: "ws-fact" }]);

        factsPushed++;
      } catch (e) {
        // Non-fatal: continue with remaining facts
        console.error(`Fact ${i} extraction failed:`, e);
      }
    }
  }

  return jsonResp({
    ok: true,
    checkpoint: {
      id: cpId,
      workspace_id: wsId,
      seq,
      checksum,
      created_at: now,
      snapshot_size: poolSnapshot.length,
      facts_extracted: factsPushed,
    },
  });
}

/**
 * POST /workspace/:id/archive
 * Archive a workspace (set status = 'archived').
 */
export async function handleWsArchive(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const now = Date.now();
  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET status = 'archived', updated_at = ? WHERE id = ?")
    .bind(now, wsId)
    .run();

  return jsonResp({ ok: true, id: wsId, status: "archived" });
}

/**
 * DELETE /workspace/:id
 * Permanently delete workspace and all its state + checkpoints.
 */
export async function handleWsDelete(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  // Verify exists
  const existing = await env.cloud_memory_db
    .prepare("SELECT id FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first();
  if (!existing) return errResp("Workspace not found", 404, request, env);

  // Delete in order: checkpoints → state → workspace
  await env.cloud_memory_db
    .prepare("DELETE FROM workspace_checkpoints WHERE workspace_id = ?")
    .bind(wsId)
    .run();
  await env.cloud_memory_db
    .prepare("DELETE FROM workspace_state WHERE workspace_id = ?")
    .bind(wsId)
    .run();
  await env.cloud_memory_db
    .prepare("DELETE FROM workspaces WHERE id = ?")
    .bind(wsId)
    .run();

  return jsonResp({ ok: true, deleted: wsId });
}

/**
 * POST /workspace/:id/search
 * Body: { q: string, k?: number }
 * Search within a workspace's state (files, variables, decisions, next_steps).
 * Returns matching entries with context.
 */
export async function handleWsSearch(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  const body = await request.json<{ q: string; k?: number }>();
  const q = (body.q || "").trim().toLowerCase();
  const k = Math.min(body.k || 10, 50);

  if (!q) return errResp("q is required", 400, request, env);

  const bundle = await loadBundle(env, wsId);
  if (!bundle) return errResp("Workspace not found", 404, request, env);

  const results: {
    category: string;
    key: string;
    match: string;
    snippet: string;
  }[] = [];

  function searchIn(category: string, key: string, value: string) {
    const lower = value.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return;

    const start = Math.max(0, idx - 80);
    const end = Math.min(value.length, idx + q.length + 80);
    const snippet = (start > 0 ? "..." : "") +
      value.slice(start, idx) +
      "**" + value.slice(idx, idx + q.length) + "**" +
      value.slice(idx + q.length, end) +
      (end < value.length ? "..." : "");
    results.push({ category, key, match: value.slice(idx, idx + q.length), snippet });
  }

  // Search files
  for (const [path, content] of Object.entries(bundle.state.files)) {
    searchIn("file", path, content);
  }

  // Search variables
  for (const [key, val] of Object.entries(bundle.state.variables)) {
    searchIn("variable", key, val);
  }

  // Search decisions
  for (const [id, desc] of Object.entries(bundle.state.decisions)) {
    searchIn("decision", id, desc);
  }

  // Search next_steps
  for (let i = 0; i < bundle.state.next_steps.length; i++) {
    searchIn("next_step", `step_${i}`, bundle.state.next_steps[i]);
  }

  // Search context
  if (bundle.state.context) {
    searchIn("context", "context", bundle.state.context);
  }

  return jsonResp({
    ok: true,
    workspace_id: wsId,
    query: q,
    results: results.slice(0, k),
    total: results.length,
  });
}

// ─── Feedback ──────────────────────────────────────────────────────────

/**
 * POST /workspace/feedback
 * Body: { workspace_id?: string, rating: 1-5, category?: string, comment?: string, agent?: string }
 * Collects user/agent feedback on workspace experience.
 */
export async function handleWsFeedback(
  request: Request,
  env: Env
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const body = await request.json<{
    workspace_id?: string;
    rating: number;
    category?: string;
    comment?: string;
    agent?: string;
  }>();

  const rating = Math.round(body.rating);
  if (rating < 1 || rating > 5) {
    return errResp("rating must be 1-5", 400, request, env);
  }

  const id = generateId();
  const now = Date.now();
  const category = (body.category || "general").trim().slice(0, 50);
  const comment = (body.comment || "").trim().slice(0, 2000);
  const agent = (body.agent || "").trim().slice(0, 100);
  const wsId = body.workspace_id?.trim() || null;

  await env.cloud_memory_db
    .prepare(
      `INSERT INTO workspace_feedback (id, workspace_id, rating, category, comment, agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, wsId, rating, category, comment || null, agent || null, now)
    .run();

  return jsonResp({ ok: true, id, rating, category, created_at: now });
}

/**
 * GET /workspace/feedback
 * Query: ?workspace_id=...&limit=50
 * List recent feedback entries (admin).
 */
export async function handleWsFeedbackList(
  request: Request,
  env: Env
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const url = new URL(request.url);
  const wsId = url.searchParams.get("workspace_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  let query = "SELECT * FROM workspace_feedback";
  const params: any[] = [];
  if (wsId) {
    query += " WHERE workspace_id = ?";
    params.push(wsId);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = params.length > 0
    ? await env.cloud_memory_db.prepare(query).bind(...params).all<any>()
    : await env.cloud_memory_db.prepare(query).all<any>();

  const entries = (rows.results || []).map((r) => ({
    id: r.id,
    workspace_id: r.workspace_id,
    rating: r.rating,
    category: r.category,
    comment: r.comment,
    agent: r.agent,
    created_at: r.created_at,
  }));

  // Compute summary stats
  const ratings = entries.map((e) => e.rating);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return jsonResp({
    ok: true,
    count: entries.length,
    avg_rating: Math.round(avgRating * 10) / 10,
    entries,
  });
}

/**
 * GET /workspace/feedback/summary
 * Query: ?workspace_id=...&days=30
 * Aggregated feedback stats: avg rating, count by category, daily trend.
 */
export async function handleWsFeedbackSummary(
  request: Request,
  env: Env
): Promise<Response> {
  // Read-only endpoint — no auth required

  const url = new URL(request.url);
  const wsId = url.searchParams.get("workspace_id");
  const days = Math.min(parseInt(url.searchParams.get("days") || "30"), 365);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  // Build WHERE clause
  let where = "WHERE created_at >= ?";
  const params: any[] = [cutoff];
  if (wsId) {
    where += " AND workspace_id = ?";
    params.push(wsId);
  }

  // Overall stats
  const overall = await env.cloud_memory_db
    .prepare(`SELECT COUNT(*) as count, AVG(rating) as avg_rating, MIN(rating) as min_rating, MAX(rating) as max_rating FROM workspace_feedback ${where}`)
    .bind(...params)
    .first<{ count: number; avg_rating: number; min_rating: number; max_rating: number }>();

  // Count by category
  const catRows = await env.cloud_memory_db
    .prepare(`SELECT category, COUNT(*) as count, AVG(rating) as avg_rating FROM workspace_feedback ${where} GROUP BY category ORDER BY count DESC`)
    .bind(...params)
    .all<{ category: string; count: number; avg_rating: number }>();

  // Daily trend (last N days)
  const trendRows = await env.cloud_memory_db
    .prepare(`
      SELECT (created_at / 86400000) * 86400000 as day,
             COUNT(*) as count,
             AVG(rating) as avg_rating
      FROM workspace_feedback ${where}
      GROUP BY day ORDER BY day ASC
    `)
    .bind(...params)
    .all<{ day: number; count: number; avg_rating: number }>();

  // Rating distribution
  const distRows = await env.cloud_memory_db
    .prepare(`SELECT rating, COUNT(*) as count FROM workspace_feedback ${where} GROUP BY rating ORDER BY rating`)
    .bind(...params)
    .all<{ rating: number; count: number }>();

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of distRows.results || []) {
    distribution[r.rating] = r.count;
  }

  return jsonResp({
    ok: true,
    days,
    total: overall?.count || 0,
    avg_rating: overall?.count ? Math.round((overall.avg_rating || 0) * 10) / 10 : 0,
    min_rating: overall?.min_rating || 0,
    max_rating: overall?.max_rating || 0,
    by_category: (catRows.results || []).map((r) => ({
      category: r.category,
      count: r.count,
      avg_rating: Math.round((r.avg_rating || 0) * 10) / 10,
    })),
    trend: (trendRows.results || []).map((r) => ({
      day: r.day,
      count: r.count,
      avg_rating: Math.round((r.avg_rating || 0) * 10) / 10,
    })),
    distribution,
  });
}

/**
 * GET /workspace/:id/checkpoints
 * List checkpoints for a workspace.
 */
export async function handleWsCheckpoints(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  const rows = await env.cloud_memory_db
    .prepare(
      "SELECT id, seq, vault_copy, fact_summary, cloud_ref, checksum, created_at FROM workspace_checkpoints WHERE workspace_id = ? ORDER BY seq DESC"
    )
    .bind(wsId)
    .all<any>();

  return jsonResp({
    ok: true,
    count: (rows.results || []).length,
    checkpoints: (rows.results || []).map((r) => ({
      id: r.id,
      seq: r.seq,
      has_vault: !!r.vault_copy,
      has_facts: !!r.fact_summary,
      has_cloud_ref: !!r.cloud_ref,
      checksum: r.checksum,
      created_at: r.created_at,
    })),
  });
}

// ─── Workspace Lifecycle ─────────────────────────────────────────────────

/**
 * POST /workspace/:id/heartbeat
 * Body: { agent?: string } — agent/machine identifier
 * Updates heartbeat timestamp. Called periodically by active agents.
 * The lease (write lock) is only extended when the caller is the current
 * owner — a passive observer may not keep someone else's lock alive.
 */
export async function handleWsHeartbeat(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  const body = await request.json<{ agent?: string }>();
  const agent = body.agent || "unknown";
  const now = Date.now();

  // Verify workspace exists + read current lease
  const existing = await env.cloud_memory_db
    .prepare("SELECT id, claimed_by FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first<{ id: string; claimed_by: string | null }>();
  if (!existing) return errResp("Workspace not found", 404, request, env);

  // Only the current lease owner may extend the lock's heartbeat.
  const isOwner = !existing.claimed_by || existing.claimed_by === agent;
  const heartbeatAt = isOwner ? now : null;

  if (heartbeatAt !== null) {
    await env.cloud_memory_db
      .prepare("UPDATE workspaces SET heartbeat_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, wsId)
      .run();
  } else {
    // Non-owner ping: record activity but do NOT extend the lock.
    await env.cloud_memory_db
      .prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?")
      .bind(now, wsId)
      .run();
  }

  return jsonResp({ ok: true, heartbeat_at: heartbeatAt !== null ? now : null, lease_extended: isOwner });
}

/**
 * POST /workspace/:id/claim
 * Body: { agent: string } — agent/machine identifier
 * Claims the workspace for exclusive use (write lock).
 * A claim is a heartbeat-based lease: it stays held while the owner
 * refreshes heartbeat_at, and expires after CLAIM_TIMEOUT_MS of silence
 * (then anyone may take over).
 */
export async function handleWsClaim(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const body = await request.json<{ agent?: string }>();
  const agent = body.agent || "unknown";
  const now = Date.now();

  // Check if already claimed by someone else
  const existing = await env.cloud_memory_db
    .prepare("SELECT id, claimed_by, claimed_at, heartbeat_at FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first<{ id: string; claimed_by: string | null; claimed_at: number | null; heartbeat_at: number | null }>();
  if (!existing) return errResp("Workspace not found", 404, request, env);

  if (existing.claimed_by && existing.claimed_by !== agent) {
    // Lease liveness = last heartbeat (or claim time if never heartbeated)
    const lastActive = existing.heartbeat_at || existing.claimed_at || 0;
    const idleMs = now - lastActive;
    if (idleMs < CLAIM_TIMEOUT_MS) {
      return errResp(`Workspace locked by '${existing.claimed_by}' (last activity ${Math.round(idleMs / 60000)} min ago)`, 409);
    }
    // Stale lease — allow takeover
  }

  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET claimed_by = ?, claimed_at = ?, heartbeat_at = ? WHERE id = ?")
    .bind(agent, now, now, wsId)
    .run();

  return jsonResp({ ok: true, claimed_by: agent, claimed_at: now, timeout_ms: CLAIM_TIMEOUT_MS });
}

/**
 * POST /workspace/:id/release
 * Body: { agent: string }
 * Releases claim on workspace.
 */
export async function handleWsRelease(
  request: Request,
  env: Env,
  wsId: string
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const body = await request.json<{ agent?: string }>();
  const agent = body.agent || "unknown";

  const existing = await env.cloud_memory_db
    .prepare("SELECT id, claimed_by FROM workspaces WHERE id = ?")
    .bind(wsId)
    .first<{ id: string; claimed_by: string | null }>();
  if (!existing) return errResp("Workspace not found", 404, request, env);

  if (existing.claimed_by && existing.claimed_by !== agent) {
    return errResp(`Workspace claimed by '${existing.claimed_by}', cannot release`, 403, request, env);
  }

  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET claimed_by = NULL, claimed_at = NULL WHERE id = ?")
    .bind(wsId)
    .run();

  return jsonResp({ ok: true, released: wsId });
}

/**
 * POST /workspace/stale-detect
 * Find and auto-pause workspaces with stale heartbeats (> 24h without activity).
 * Returns list of paused workspaces.
 */
export async function handleWsStaleDetect(
  request: Request,
  env: Env
): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);

  const now = Date.now();
  const staleThreshold = 24 * 3600 * 1000; // 24 hours

  // Find active workspaces with stale heartbeat (or never heartbeated but old)
  const stale = await env.cloud_memory_db
    .prepare(`
      SELECT id, name, heartbeat_at, claimed_by, updated_at
      FROM workspaces
      WHERE status = 'active'
        AND (
          (heartbeat_at IS NOT NULL AND heartbeat_at < ?)
          OR (heartbeat_at IS NULL AND updated_at < ?)
        )
    `)
    .bind(now - staleThreshold, now - staleThreshold)
    .all<{ id: string; name: string; heartbeat_at: number | null; claimed_by: string | null; updated_at: number }>();

  const paused: { id: string; name: string; idle_hours: number }[] = [];

  for (const ws of stale.results || []) {
    await env.cloud_memory_db
      .prepare("UPDATE workspaces SET status = 'paused', claimed_by = NULL, claimed_at = NULL WHERE id = ?")
      .bind(ws.id)
      .run();

    const lastActivity = ws.heartbeat_at || ws.updated_at;
    const idleHours = Math.round((now - lastActivity) / 3600000);
    paused.push({ id: ws.id, name: ws.name, idle_hours: idleHours });
  }

  return jsonResp({
    ok: true,
    paused_count: paused.length,
    paused,
  });
}

/**
 * GET /workspace/pool-status
 * Full pool status: active, paused, claimed, stale, etc.
 */
export async function handleWsPoolStatus(
  request: Request,
  env: Env
): Promise<Response> {
  const now = Date.now();

  const active = await env.cloud_memory_db
    .prepare("SELECT COUNT(*) as count FROM workspaces WHERE status = 'active'")
    .first<{ count: number }>();

  const paused = await env.cloud_memory_db
    .prepare("SELECT COUNT(*) as count FROM workspaces WHERE status = 'paused'")
    .first<{ count: number }>();

  const archived = await env.cloud_memory_db
    .prepare("SELECT COUNT(*) as count FROM workspaces WHERE status = 'archived'")
    .first<{ count: number }>();

  const claimed = await env.cloud_memory_db
    .prepare("SELECT id, name, claimed_by, claimed_at, heartbeat_at FROM workspaces WHERE claimed_by IS NOT NULL AND status = 'active'")
    .all<{ id: string; name: string; claimed_by: string; claimed_at: number; heartbeat_at: number | null }>();

  // Workspaces with heartbeat > 2h old (potential stale)
  const potentiallyStale = await env.cloud_memory_db
    .prepare(`
      SELECT id, name, heartbeat_at, updated_at
      FROM workspaces
      WHERE status = 'active'
        AND heartbeat_at IS NOT NULL
        AND heartbeat_at < ?
    `)
    .bind(now - 2 * 3600 * 1000)
    .all<{ id: string; name: string; heartbeat_at: number; updated_at: number }>();

  return jsonResp({
    ok: true,
    active: active?.count || 0,
    paused: paused?.count || 0,
    archived: archived?.count || 0,
    total: (active?.count || 0) + (paused?.count || 0) + (archived?.count || 0),
    claimed: (claimed.results || []).map(ws => ({
      id: ws.id,
      name: ws.name,
      claimed_by: ws.claimed_by,
      claimed_ago_min: Math.round((now - ws.claimed_at) / 60000),
      heartbeat_ago_min: ws.heartbeat_at ? Math.round((now - ws.heartbeat_at) / 60000) : null,
    })),
    potentially_stale: (potentiallyStale.results || []).map(ws => ({
      id: ws.id,
      name: ws.name,
      idle_hours: Math.round((now - (ws.heartbeat_at || ws.updated_at)) / 3600000),
    })),
  });
}

// ─── Workspace Dashboard ──────────────────────────────────────────────────

import { dashboardHtml, editorHtml } from "./workspace_html";

export function handleWorkspaceDashboard(_env: Env, request?: Request): Response {
  const html = dashboardHtml();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...(request ? corsHeaders(request, _env || env) : corsHeadersAny()) },
  });
}

// ─── Workspace Editor UI ──────────────────────────────────────────────────

export function handleWorkspaceEditor(_env: Env, request?: Request): Response {
  const html = editorHtml();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...(request ? corsHeaders(request, _env || env) : corsHeadersAny()) },
  });
}

// dummy to skip old code

/* ═══════════════════════════════════════════════════════════════════════════
 * Project layer — "nest" grouping multiple workspace sessions
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function ensureProjectTables(env: Env): Promise<void> {
  await env.cloud_memory_db
    .prepare(
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )`
    )
    .run();
  // workspaces.project_id column migration (idempotent)
  try {
    await env.cloud_memory_db.prepare("ALTER TABLE workspaces ADD COLUMN project_id TEXT").run();
  } catch {
    // column already exists
  }

  // workspaces.client_key column migration (idempotency key for client-side auto-capture)
  try {
    await env.cloud_memory_db.prepare("ALTER TABLE workspaces ADD COLUMN client_key TEXT").run();
  } catch {
    // column already exists
  }
  try {
    await env.cloud_memory_db.prepare("CREATE INDEX IF NOT EXISTS idx_ws_project ON workspaces(project_id)").run();
  } catch {
    // ignore
  }
}

/** GET /projects — list projects with per-project session stats */
export async function handleProjectList(request: Request, env: Env): Promise<Response> {
  await ensureProjectTables(env);
  const projects = await env.cloud_memory_db
    .prepare("SELECT * FROM projects ORDER BY created_at ASC")
    .all<any>();
  const projs = (projects.results || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    workspace_count: 0,
    active: 0,
    paused: 0,
    archived: 0,
    claimed: 0,
    stale: 0,
  }));

  const now = Date.now();
  const stats = await env.cloud_memory_db
    .prepare(
      `SELECT project_id, status, COUNT(*) AS n,
              SUM(CASE WHEN claimed_by IS NOT NULL THEN 1 ELSE 0 END) AS claimed,
              SUM(CASE WHEN (heartbeat_at IS NOT NULL AND heartbeat_at < ?) THEN 1 ELSE 0 END) AS stale
       FROM workspaces GROUP BY project_id, status`
    )
    .bind(now - 2 * 3600 * 1000)
    .all<any>();

  const byId: Record<string, any> = {};
  projs.forEach((p) => { byId[p.id] = p; });
  const unsorted = { id: "", name: "(unsorted)", description: null, created_at: 0, updated_at: 0, workspace_count: 0, active: 0, paused: 0, archived: 0, claimed: 0, stale: 0 };

  for (const s of stats.results || []) {
    const key = s.project_id || "";
    const bucket = key ? byId[key] : unsorted;
    if (!bucket) continue;
    bucket.workspace_count += s.n;
    bucket[s.status] = (bucket[s.status] || 0) + s.n;
    bucket.claimed += s.claimed || 0;
    bucket.stale += s.stale || 0;
  }

  return jsonResp({
    ok: true,
    count: projs.length,
    projects: projs,
    unsorted,
  });
}

/** POST /projects — create a project (auth required) */
export async function handleProjectCreate(request: Request, env: Env): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);
  await ensureProjectTables(env);
  const body = await request.json<{ name?: string; description?: string }>();
  const name = body.name?.trim();
  if (!name) return errResp("name is required", 400, request, env);
  const id = generateId();
  const now = Date.now();
  await env.cloud_memory_db
    .prepare("INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, body.description?.trim() || null, now, now)
    .run();
  const row = await env.cloud_memory_db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<any>();
  return jsonResp({ ok: true, project: { id: row.id, name: row.name, description: row.description, created_at: row.created_at, updated_at: row.updated_at } }, 201, request, env);
}

/** POST /projects/:id — rename/update a project (auth required) */
export async function handleProjectUpdate(request: Request, env: Env, projectId: string): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);
  await ensureProjectTables(env);
  const existing = await env.cloud_memory_db.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
  if (!existing) return errResp("Project not found", 404, request, env);
  const body = await request.json<{ name?: string; description?: string }>();
  const meta: string[] = ["updated_at=?"];
  const vals: (string | number)[] = [Date.now()];
  if (body.name !== undefined) { const n = body.name.trim(); if (n) { meta.push("name=?"); vals.push(n); } }
  if (body.description !== undefined) { meta.push("description=?"); vals.push(body.description.trim() || null); }
  vals.push(projectId);
  await env.cloud_memory_db.prepare(`UPDATE projects SET ${meta.join(", ")} WHERE id=?`).bind(...vals).run();
  const row = await env.cloud_memory_db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first<any>();
  return jsonResp({ ok: true, project: { id: row.id, name: row.name, description: row.description, updated_at: row.updated_at } });
}

/** DELETE /projects/:id — delete a project; its workspaces become unsorted (auth required) */
export async function handleProjectDelete(request: Request, env: Env, projectId: string): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);
  await ensureProjectTables(env);
  const existing = await env.cloud_memory_db.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
  if (!existing) return errResp("Project not found", 404, request, env);
  await env.cloud_memory_db.prepare("UPDATE workspaces SET project_id = NULL WHERE project_id = ?").bind(projectId).run();
  await env.cloud_memory_db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();
  return jsonResp({ ok: true, unassigned: true });
}

/** POST /workspace/:id/assign — move a workspace into/out of a project (auth required) */
export async function handleWsAssign(request: Request, env: Env, wsId: string): Promise<Response> {
  if (!checkAuth(request, env)) return errResp("Unauthorized", 401, request, env);
  await ensureProjectTables(env);
  const existing = await env.cloud_memory_db.prepare("SELECT id FROM workspaces WHERE id = ?").bind(wsId).first();
  if (!existing) return errResp("Workspace not found", 404, request, env);
  const body = await request.json<{ project_id?: string | null; agent?: string }>();
  const projectId = body.project_id || null;
  if (projectId) {
    const proj = await env.cloud_memory_db.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
    if (!proj) return errResp("Project not found", 404, request, env);
  }
  const leaseErr = await requireWriteLease(env, wsId, body.agent || "unknown", request);
  if (leaseErr) return leaseErr;
  await env.cloud_memory_db
    .prepare("UPDATE workspaces SET project_id = ?, updated_at = ? WHERE id = ?")
    .bind(projectId, Date.now(), wsId)
    .run();
  const bundle = await loadBundle(env, wsId);
  return jsonResp({ ok: true, workspace: bundle });
}
