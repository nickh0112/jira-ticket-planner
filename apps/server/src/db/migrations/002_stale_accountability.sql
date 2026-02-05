-- Stale Ticket & Accountability Tracking Tables

CREATE TABLE IF NOT EXISTS stale_ticket_detections (
  id TEXT PRIMARY KEY,
  jira_key TEXT NOT NULL,
  detection_type TEXT NOT NULL CHECK (detection_type IN ('pr_merged_ticket_open', 'commits_no_progress', 'ticket_stale_in_status', 'pr_open_no_review', 'pipeline_failing')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  team_member_id TEXT REFERENCES team_members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id TEXT PRIMARY KEY,
  jira_key TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accountability_flags (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id),
  flag_type TEXT NOT NULL CHECK (flag_type IN ('stuck_ticket', 'no_commits', 'overdue_action_item', 'sprint_risk')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS engineer_patterns (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id),
  week_start TEXT NOT NULL,
  tickets_completed INTEGER DEFAULT 0,
  tickets_started INTEGER DEFAULT 0,
  commits_count INTEGER DEFAULT 0,
  prs_merged INTEGER DEFAULT 0,
  avg_cycle_time_hours REAL,
  ai_analysis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_member_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_stale_detections_status ON stale_ticket_detections(status);
CREATE INDEX IF NOT EXISTS idx_stale_detections_jira_key ON stale_ticket_detections(jira_key);
CREATE INDEX IF NOT EXISTS idx_stale_detections_type ON stale_ticket_detections(detection_type);
CREATE INDEX IF NOT EXISTS idx_status_history_jira_key ON ticket_status_history(jira_key);
CREATE INDEX IF NOT EXISTS idx_accountability_flags_member ON accountability_flags(team_member_id);
CREATE INDEX IF NOT EXISTS idx_accountability_flags_status ON accountability_flags(status);
CREATE INDEX IF NOT EXISTS idx_engineer_patterns_member ON engineer_patterns(team_member_id);
