-- Sprint Health Monitor Tables

CREATE TABLE IF NOT EXISTS sprint_snapshots (
  id TEXT PRIMARY KEY,
  sprint_id INTEGER NOT NULL,
  sprint_name TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  total_tickets INTEGER NOT NULL DEFAULT 0,
  completed_tickets INTEGER NOT NULL DEFAULT 0,
  in_progress_tickets INTEGER NOT NULL DEFAULT 0,
  todo_tickets INTEGER NOT NULL DEFAULT 0,
  total_story_points REAL,
  completed_story_points REAL,
  per_engineer_data TEXT NOT NULL DEFAULT '[]',
  health_score REAL,
  ai_analysis TEXT,
  days_remaining INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sprint_snapshots_sprint ON sprint_snapshots(sprint_id);

-- Reports Tables

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily_standup', 'weekly_leadership', 'sprint_report')),
  title TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  structured_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL UNIQUE,
  sections TEXT NOT NULL DEFAULT '[]',
  custom_instructions TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
