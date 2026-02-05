-- Automation Engine Tables
CREATE TABLE IF NOT EXISTS automation_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  enabled INTEGER NOT NULL DEFAULT 0,
  check_interval_minutes INTEGER NOT NULL DEFAULT 15,
  auto_approve_threshold REAL NOT NULL DEFAULT 1.0,
  notify_on_new_actions INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize singleton
INSERT OR IGNORE INTO automation_config (id) VALUES ('singleton');

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  checks_run TEXT NOT NULL DEFAULT '[]',
  actions_proposed INTEGER NOT NULL DEFAULT 0,
  actions_auto_approved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error TEXT
);

CREATE TABLE IF NOT EXISTS automation_actions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES automation_runs(id),
  type TEXT NOT NULL,
  check_module TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_actions_run ON automation_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_status ON automation_actions(status);
CREATE INDEX IF NOT EXISTS idx_automation_actions_type ON automation_actions(type);
