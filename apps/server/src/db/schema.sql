-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  skills TEXT NOT NULL, -- JSON array stored as string
  jira_username TEXT,
  bitbucket_username TEXT,
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
  feature_group_id TEXT, -- UUID to link related tickets (e.g., FE/BE/ML split from same feature)
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
CREATE INDEX IF NOT EXISTS idx_tickets_feature_group_id ON tickets(feature_group_id);

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

-- ============================================================================
-- PM Operating System Tables
-- ============================================================================

-- PM assignment tracking (when PM assigns tickets via this app)
CREATE TABLE IF NOT EXISTS pm_assignments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT,
  jira_key TEXT,
  assignee_id TEXT NOT NULL REFERENCES team_members(id),
  assigned_by TEXT NOT NULL DEFAULT 'pm',
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  time_to_completion_hours REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily activity summary per engineer
CREATE TABLE IF NOT EXISTS engineer_activity (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id),
  activity_date TEXT NOT NULL,
  tickets_assigned INTEGER DEFAULT 0,
  tickets_completed INTEGER DEFAULT 0,
  last_activity_at TEXT,
  UNIQUE(team_member_id, activity_date)
);

-- PM alerts for underutilization/inactivity
CREATE TABLE IF NOT EXISTS pm_alerts (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('no_assignment', 'no_activity')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  is_dismissed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI ticket suggestions for underutilized engineers
CREATE TABLE IF NOT EXISTS ai_ticket_suggestions (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id),
  ticket_id TEXT,
  jira_key TEXT,
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  skill_match_score REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PM config singleton (thresholds and settings)
CREATE TABLE IF NOT EXISTS pm_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  underutilization_days INTEGER DEFAULT 2,
  inactivity_days INTEGER DEFAULT 2,
  check_interval_hours INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- PM Tables Indexes
CREATE INDEX IF NOT EXISTS idx_pm_assignments_assignee ON pm_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_pm_assignments_completed ON pm_assignments(completed_at);
CREATE INDEX IF NOT EXISTS idx_engineer_activity_member ON engineer_activity(team_member_id);
CREATE INDEX IF NOT EXISTS idx_engineer_activity_date ON engineer_activity(activity_date);
CREATE INDEX IF NOT EXISTS idx_pm_alerts_active ON pm_alerts(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_pm_alerts_member ON pm_alerts(team_member_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending ON ai_ticket_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_member ON ai_ticket_suggestions(team_member_id);

-- ============================================================================
-- Ideas Feature Tables (Forge)
-- ============================================================================

-- Idea sessions - conversation container
CREATE TABLE IF NOT EXISTS idea_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'brainstorming'
    CHECK (status IN ('brainstorming', 'prd_generated', 'tickets_created', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS idea_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES idea_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Generated PRDs
CREATE TABLE IF NOT EXISTS idea_prds (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE REFERENCES idea_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  goals TEXT NOT NULL,                    -- JSON array
  user_stories TEXT NOT NULL,             -- JSON array
  functional_requirements TEXT NOT NULL,  -- JSON array
  non_functional_requirements TEXT NOT NULL,
  success_metrics TEXT NOT NULL,
  scope_boundaries TEXT NOT NULL,         -- JSON {inScope: [], outOfScope: []}
  technical_considerations TEXT,
  raw_content TEXT NOT NULL,              -- Full markdown
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ticket proposals (before creation)
CREATE TABLE IF NOT EXISTS idea_ticket_proposals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES idea_sessions(id) ON DELETE CASCADE,
  prd_id TEXT NOT NULL REFERENCES idea_prds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,      -- JSON array
  ticket_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('frontend', 'backend', 'design', 'fullstack', 'infrastructure', 'data')),
  required_skills TEXT NOT NULL DEFAULT '[]',
  suggested_assignee_id TEXT REFERENCES team_members(id),
  suggested_epic_id TEXT REFERENCES epics(id),
  assignment_confidence REAL DEFAULT 0,
  assignment_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'created')),
  created_ticket_id TEXT REFERENCES tickets(id),
  feature_group_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ideas Tables Indexes
CREATE INDEX IF NOT EXISTS idx_idea_sessions_status ON idea_sessions(status);
CREATE INDEX IF NOT EXISTS idx_idea_sessions_updated ON idea_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_idea_messages_session ON idea_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_idea_messages_created ON idea_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_idea_prds_session ON idea_prds(session_id);
CREATE INDEX IF NOT EXISTS idx_idea_proposals_session ON idea_ticket_proposals(session_id);
CREATE INDEX IF NOT EXISTS idx_idea_proposals_prd ON idea_ticket_proposals(prd_id);
CREATE INDEX IF NOT EXISTS idx_idea_proposals_status ON idea_ticket_proposals(status);
CREATE INDEX IF NOT EXISTS idx_idea_proposals_feature_group ON idea_ticket_proposals(feature_group_id);

-- ============================================================================
-- Project Context Table (for AI brainstorming context)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_context (
  id TEXT PRIMARY KEY DEFAULT 'default',
  project_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '',
  architecture TEXT NOT NULL DEFAULT '',
  product_areas TEXT NOT NULL DEFAULT '',
  conventions TEXT NOT NULL DEFAULT '',
  additional_context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Bitbucket Integration Tables
-- ============================================================================

-- Bitbucket Configuration (singleton pattern)
CREATE TABLE IF NOT EXISTS bitbucket_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  workspace TEXT NOT NULL,
  username TEXT NOT NULL,
  app_password TEXT NOT NULL,
  sync_interval INTEGER NOT NULL DEFAULT 300,
  auto_discover_repos INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discovered/Tracked Repositories
CREATE TABLE IF NOT EXISTS bitbucket_repos (
  slug TEXT PRIMARY KEY,
  name TEXT,
  workspace TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  discovered_via TEXT NOT NULL DEFAULT 'auto' CHECK (discovered_via IN ('auto', 'manual'))
);

-- Pull Requests
CREATE TABLE IF NOT EXISTS bitbucket_pull_requests (
  id INTEGER PRIMARY KEY,
  repo_slug TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  author_username TEXT,
  author_display_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('OPEN', 'MERGED', 'DECLINED')),
  source_branch TEXT,
  destination_branch TEXT,
  reviewers TEXT, -- JSON: [{username, displayName, status, approvedAt}]
  jira_key TEXT,
  created_at TEXT,
  updated_at TEXT,
  merged_at TEXT,
  team_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
  UNIQUE(repo_slug, pr_number)
);

-- Commits
CREATE TABLE IF NOT EXISTS bitbucket_commits (
  hash TEXT PRIMARY KEY,
  repo_slug TEXT NOT NULL,
  author_username TEXT,
  author_display_name TEXT,
  message TEXT,
  jira_key TEXT,
  committed_at TEXT,
  team_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL
);

-- Pipeline Runs
CREATE TABLE IF NOT EXISTS bitbucket_pipelines (
  uuid TEXT PRIMARY KEY,
  repo_slug TEXT NOT NULL,
  build_number INTEGER,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'IN_PROGRESS', 'SUCCESSFUL', 'FAILED', 'STOPPED')),
  result TEXT CHECK (result IN ('successful', 'failed', 'error')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('push', 'pull_request', 'manual')),
  branch TEXT,
  commit_hash TEXT,
  duration_seconds INTEGER,
  created_at TEXT,
  completed_at TEXT
);

-- Bitbucket XP Awards (extends existing XP system)
CREATE TABLE IF NOT EXISTS bitbucket_xp_awards (
  id TEXT PRIMARY KEY,
  team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pr_merged', 'pr_reviewed', 'pr_reviewed_changes', 'commit', 'pipeline_fixed')),
  reference_id TEXT NOT NULL,
  repo_slug TEXT,
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, reference_id)
);

-- Bitbucket Sync State (singleton pattern)
CREATE TABLE IF NOT EXISTS bitbucket_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_sync_at TEXT,
  last_successful_sync_at TEXT,
  sync_interval_ms INTEGER NOT NULL DEFAULT 300000,
  sync_enabled INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bitbucket Tables Indexes
CREATE INDEX IF NOT EXISTS idx_bitbucket_prs_repo ON bitbucket_pull_requests(repo_slug);
CREATE INDEX IF NOT EXISTS idx_bitbucket_prs_state ON bitbucket_pull_requests(state);
CREATE INDEX IF NOT EXISTS idx_bitbucket_prs_author ON bitbucket_pull_requests(author_username);
CREATE INDEX IF NOT EXISTS idx_bitbucket_prs_jira ON bitbucket_pull_requests(jira_key);
CREATE INDEX IF NOT EXISTS idx_bitbucket_prs_member ON bitbucket_pull_requests(team_member_id);
CREATE INDEX IF NOT EXISTS idx_bitbucket_commits_repo ON bitbucket_commits(repo_slug);
CREATE INDEX IF NOT EXISTS idx_bitbucket_commits_author ON bitbucket_commits(author_username);
CREATE INDEX IF NOT EXISTS idx_bitbucket_commits_jira ON bitbucket_commits(jira_key);
CREATE INDEX IF NOT EXISTS idx_bitbucket_commits_member ON bitbucket_commits(team_member_id);
CREATE INDEX IF NOT EXISTS idx_bitbucket_pipelines_repo ON bitbucket_pipelines(repo_slug);
CREATE INDEX IF NOT EXISTS idx_bitbucket_pipelines_state ON bitbucket_pipelines(state);
CREATE INDEX IF NOT EXISTS idx_bitbucket_xp_member ON bitbucket_xp_awards(team_member_id);
CREATE INDEX IF NOT EXISTS idx_bitbucket_xp_source ON bitbucket_xp_awards(source);
CREATE INDEX IF NOT EXISTS idx_bitbucket_repos_active ON bitbucket_repos(is_active);
