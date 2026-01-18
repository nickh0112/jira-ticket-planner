-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  skills TEXT NOT NULL, -- JSON array stored as string
  jira_username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Epics table
CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL, -- JSON array stored as string
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('feature', 'bug', 'improvement', 'task', 'design')),
  priority TEXT NOT NULL CHECK (priority IN ('highest', 'high', 'medium', 'low', 'lowest')),
  epic_id TEXT REFERENCES epics(id) ON DELETE SET NULL,
  assignee_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
  labels TEXT NOT NULL DEFAULT '[]', -- JSON array stored as string
  required_skills TEXT NOT NULL DEFAULT '[]', -- JSON array of inferred skills needed for this ticket
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'created')),
  created_in_jira INTEGER NOT NULL DEFAULT 0,
  jira_key TEXT,
  jira_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jira configuration table
CREATE TABLE IF NOT EXISTS jira_config (
  id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  project_key TEXT NOT NULL,
  epic_link_field TEXT,
  team_name TEXT,
  default_board_id INTEGER,
  design_board_id INTEGER,
  work_type_field_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jira sprints cache table
CREATE TABLE IF NOT EXISTS jira_sprints (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active', 'future', 'closed')),
  start_date TEXT,
  end_date TEXT,
  board_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_epic_id ON tickets(epic_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);

-- Agent knowledge table for storing learned patterns
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id TEXT PRIMARY KEY,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('ticket_pattern', 'epic_category', 'skill_inference', 'field_pattern', 'assignment_pattern')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inferred team member skills from Jira history
CREATE TABLE IF NOT EXISTS team_member_skills_inferred (
  id TEXT PRIMARY KEY,
  team_member_id TEXT REFERENCES team_members(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  evidence TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Epic categories for better semantic matching
CREATE TABLE IF NOT EXISTS epic_categories (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  keywords TEXT, -- JSON array stored as string
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ticket enhancements storage
CREATE TABLE IF NOT EXISTS ticket_enhancements (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  original_description TEXT NOT NULL,
  enhanced_description TEXT NOT NULL,
  added_acceptance_criteria TEXT NOT NULL, -- JSON array stored as string
  success_metrics TEXT NOT NULL, -- JSON array stored as string
  technical_context TEXT NOT NULL,
  ai_coding_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pending epic proposals awaiting approval
CREATE TABLE IF NOT EXISTS pending_epic_proposals (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  proposed_name TEXT NOT NULL,
  proposed_key TEXT NOT NULL,
  proposed_description TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  reasoning TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for agent tables
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON agent_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_key ON agent_knowledge(key);
CREATE INDEX IF NOT EXISTS idx_inferred_skills_member ON team_member_skills_inferred(team_member_id);
CREATE INDEX IF NOT EXISTS idx_epic_categories_epic ON epic_categories(epic_id);
CREATE INDEX IF NOT EXISTS idx_ticket_enhancements_ticket ON ticket_enhancements(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pending_epic_proposals_ticket ON pending_epic_proposals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pending_epic_proposals_status ON pending_epic_proposals(status);

-- ============================================================================
-- RTS Team Visualization Tables
-- ============================================================================

-- Per-member progress tracking
CREATE TABLE IF NOT EXISTS member_progress (
  id TEXT PRIMARY KEY,
  team_member_id TEXT UNIQUE REFERENCES team_members(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Recruit',
  tickets_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ticket completion history (prevents duplicate XP)
CREATE TABLE IF NOT EXISTS ticket_completions (
  id TEXT PRIMARY KEY,
  jira_key TEXT NOT NULL UNIQUE,
  team_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
  completed_at TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  completion_source TEXT NOT NULL CHECK (completion_source IN ('jira_sync', 'manual')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jira sync state
CREATE TABLE IF NOT EXISTS jira_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_sync_at TEXT,
  last_successful_sync_at TEXT,
  sync_interval_ms INTEGER NOT NULL DEFAULT 300000,
  sync_enabled INTEGER NOT NULL DEFAULT 0,
  baseline_date TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Level-up event queue (for RTS animations)
CREATE TABLE IF NOT EXISTS level_up_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('member', 'ai')),
  entity_id TEXT NOT NULL,
  old_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  new_title TEXT NOT NULL,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged INTEGER NOT NULL DEFAULT 0
);

-- World configuration
CREATE TABLE IF NOT EXISTS world_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 800,
  basecamp_x REAL NOT NULL DEFAULT 100,
  basecamp_y REAL NOT NULL DEFAULT 400,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Campaign regions (epic territories)
CREATE TABLE IF NOT EXISTS campaign_regions (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  color TEXT NOT NULL DEFAULT '#4A4136',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI team members (future)
CREATE TABLE IF NOT EXISTS ai_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Basic Algorithm',
  actions_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RTS Tables Indexes
CREATE INDEX IF NOT EXISTS idx_member_progress_member ON member_progress(team_member_id);
CREATE INDEX IF NOT EXISTS idx_ticket_completions_member ON ticket_completions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_level_up_events_unacked ON level_up_events(acknowledged);
CREATE INDEX IF NOT EXISTS idx_campaign_regions_epic ON campaign_regions(epic_id);
