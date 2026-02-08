CREATE TABLE IF NOT EXISTS codebase_contexts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  analyzed_at TEXT NOT NULL,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_directories INTEGER NOT NULL DEFAULT 0,
  language_breakdown TEXT NOT NULL DEFAULT '{}',
  context_summary TEXT NOT NULL,
  raw_analysis TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE idea_ticket_proposals ADD COLUMN affected_files TEXT DEFAULT '[]';
ALTER TABLE idea_ticket_proposals ADD COLUMN implementation_hints TEXT;
