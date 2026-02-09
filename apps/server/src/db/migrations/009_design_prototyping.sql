-- Design Prototyping Tables
-- Enables Claude-powered design sessions with live React/Tailwind prototypes

-- Design sessions - conversation container for design prototyping
CREATE TABLE IF NOT EXISTS design_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'freeform'
    CHECK (source_type IN ('ticket', 'prd', 'freeform')),
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'designing'
    CHECK (status IN ('designing', 'prototype_generated', 'approved', 'shared')),
  codebase_context_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Design conversation messages
CREATE TABLE IF NOT EXISTS design_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES design_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Design prototypes (versioned React/Tailwind components)
CREATE TABLE IF NOT EXISTS design_prototypes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES design_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  component_code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_design_sessions_status ON design_sessions(status);
CREATE INDEX IF NOT EXISTS idx_design_sessions_updated ON design_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_messages_session ON design_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_design_prototypes_session ON design_prototypes(session_id);
