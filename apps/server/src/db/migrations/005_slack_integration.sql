-- Slack Integration Tables

CREATE TABLE IF NOT EXISTS slack_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  bot_token TEXT,
  monitored_channels TEXT NOT NULL DEFAULT '[]',
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  message_retention_days INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize singleton
INSERT OR IGNORE INTO slack_config (id) VALUES ('singleton');

CREATE TABLE IF NOT EXISTS slack_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_monitored INTEGER NOT NULL DEFAULT 0,
  last_sync_cursor TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slack_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES slack_channels(id),
  user_id TEXT,
  user_name TEXT,
  text TEXT NOT NULL,
  thread_ts TEXT,
  ts TEXT NOT NULL,
  jira_keys TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slack_thread_summaries (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  thread_ts TEXT NOT NULL,
  summary TEXT NOT NULL,
  decisions TEXT,
  action_items TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, thread_ts)
);

CREATE TABLE IF NOT EXISTS slack_insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('decision', 'action_item', 'blocker', 'update')),
  content TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  jira_key TEXT,
  team_member_id TEXT REFERENCES team_members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slack_user_mapping (
  slack_user_id TEXT PRIMARY KEY,
  team_member_id TEXT REFERENCES team_members(id),
  slack_display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS slack_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_sync_at TEXT,
  last_successful_sync_at TEXT,
  is_syncing INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize singleton
INSERT OR IGNORE INTO slack_sync_state (id) VALUES ('singleton');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_messages_channel ON slack_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_ts ON slack_messages(ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread ON slack_messages(thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_insights_type ON slack_insights(type);
CREATE INDEX IF NOT EXISTS idx_slack_insights_jira_key ON slack_insights(jira_key);
CREATE INDEX IF NOT EXISTS idx_slack_insights_channel ON slack_insights(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_thread_summaries_channel ON slack_thread_summaries(channel_id);

-- Note: slack_user_id column on team_members is added via
-- the runMigrations() PRAGMA table_info check in storageService.ts
