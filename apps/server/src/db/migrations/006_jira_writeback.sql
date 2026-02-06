-- Jira write-back sync tracking
ALTER TABLE tickets ADD COLUMN jira_synced_at TEXT;

-- Jira config extensions for automation
ALTER TABLE jira_config ADD COLUMN auto_assign_on_suggestion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE jira_config ADD COLUMN auto_execute_actions INTEGER NOT NULL DEFAULT 0;

-- Track Jira sync failures for retry and observability
CREATE TABLE IF NOT EXISTS jira_sync_failures (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  jira_key TEXT,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
