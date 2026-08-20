-- ═══════════════════════════════════════════════════════════════
-- workspace_schema.sql — Cloud Workspace Pool (extends cloud-memory)
-- ═══════════════════════════════════════════════════════════════
--
-- Design: workspace = active unit of work, NOT passive memory.
-- Bundle = lossless state: files + variables + decisions + next_steps.
-- "loaded = knows" — no search needed, just open/close.
--
-- 4-way checkpoint: pool / vault / fact / cloud
-- ═══════════════════════════════════════════════════════════════

-- Workspace metadata
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'active',   -- active | paused | archived
  claimed_by TEXT,                -- agent/machine that claimed this workspace (NULL = unclaimed)
  claimed_at INTEGER,             -- when claim was made
  heartbeat_at INTEGER,           -- last heartbeat timestamp
  file_count INTEGER DEFAULT 0,
  variable_count INTEGER DEFAULT 0,
  decision_count INTEGER DEFAULT 0,
  next_step_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  last_checkpoint_at INTEGER
);

-- Workspace state entries — lossless bundle
-- Each row = one entry in one category of one workspace.
-- key = filename / variable name / decision id / step ordinal.
-- value = full content (JSON string for complex types, plain string for files).
CREATE TABLE IF NOT EXISTS workspace_state (
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL,         -- 'file' | 'variable' | 'decision' | 'next_step' | 'context'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER,
  PRIMARY KEY (workspace_id, category, key)
);

-- Workspace checkpoints — 4-way snapshots
CREATE TABLE IF NOT EXISTS workspace_checkpoints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  seq INTEGER NOT NULL,           -- monotonic sequence number
  pool_snapshot TEXT NOT NULL,    -- full workspace state JSON at checkpoint time
  vault_copy TEXT,                -- persistent vault copy (for long-term storage)
  fact_summary TEXT,              -- extracted facts (optional, can be generated later)
  cloud_ref TEXT,                 -- reference to external cloud storage (optional)
  checksum TEXT NOT NULL,         -- CRC-64 of pool_snapshot for integrity
  created_at INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ws_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_ws_state_ws ON workspace_state(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_ckpt_ws ON workspace_checkpoints(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_ckpt_seq ON workspace_checkpoints(workspace_id, seq);
