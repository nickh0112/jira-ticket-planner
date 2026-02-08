import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  Ticket,
  CreateTicketInput,
  UpdateTicketInput,
  TeamMember,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
  Epic,
  CreateEpicInput,
  UpdateEpicInput,
  TicketStatus,
  JiraConfig,
  JiraConfigInput,
  JiraSprint,
  AgentKnowledge,
  KnowledgeType,
  InferredSkill,
  EpicCategory,
  TicketEnhancements,
  EpicSuggestion,
  MemberProgress,
  JiraSyncState,
  WorldConfig,
  CampaignRegion,
  TicketCompletion,
  LevelUpEvent,
  CreateCampaignRegionInput,
  UpdateWorldConfigInput,
  UpdateJiraSyncConfigInput,
  UpdateMemberPositionInput,
  PMAssignment,
  CreatePMAssignmentInput,
  EngineerActivity,
  PMAlert,
  CreatePMAlertInput,
  AITicketSuggestion,
  CreateAISuggestionInput,
  PMConfig,
  UpdatePMConfigInput,
  AISuggestionStatus,
  IdeaSession,
  CreateIdeaSessionInput,
  UpdateIdeaSessionInput,
  IdeaMessage,
  CreateIdeaMessageInput,
  IdeaPRD,
  CreateIdeaPRDInput,
  UpdateIdeaPRDInput,
  IdeaTicketProposal,
  CreateTicketProposalInput,
  UpdateTicketProposalInput,
  IdeaSessionFull,
  TicketProposalStatus,
  ProjectContext,
  ProjectContextInput,
  BitbucketConfig,
  CreateBitbucketConfigInput,
  UpdateBitbucketConfigInput,
  BitbucketRepo,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPipeline,
  BitbucketXPAward,
  BitbucketSyncState,
  UpdateBitbucketSyncConfigInput,
  AutomationConfig,
  AutomationRun,
  AutomationAction,
  AutomationActionStatus,
  UpdateAutomationConfigInput,
  SlackConfig,
  UpdateSlackConfigInput,
  SlackChannel,
  SlackMessage,
  SlackThreadSummary,
  SlackInsight,
  SlackInsightType,
  SlackUserMapping,
  SlackSyncState,
  CodebaseContext,
  CodebaseContextListItem,
} from '@jira-planner/shared';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class StorageService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema() {
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);

    // Create migrations tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.runMigrations();
    this.runNumberedMigrations();
  }

  private runMigrations() {
    // Add jira_key and jira_url columns to tickets if they don't exist
    const ticketColumns = this.db.prepare("PRAGMA table_info(tickets)").all() as { name: string }[];
    const ticketColumnNames = ticketColumns.map((c) => c.name);

    if (!ticketColumnNames.includes('jira_key')) {
      this.db.exec('ALTER TABLE tickets ADD COLUMN jira_key TEXT');
    }
    if (!ticketColumnNames.includes('jira_url')) {
      this.db.exec('ALTER TABLE tickets ADD COLUMN jira_url TEXT');
    }
    if (!ticketColumnNames.includes('labels')) {
      this.db.exec("ALTER TABLE tickets ADD COLUMN labels TEXT NOT NULL DEFAULT '[]'");
    }
    if (!ticketColumnNames.includes('required_skills')) {
      this.db.exec("ALTER TABLE tickets ADD COLUMN required_skills TEXT NOT NULL DEFAULT '[]'");
    }
    if (!ticketColumnNames.includes('feature_group_id')) {
      this.db.exec('ALTER TABLE tickets ADD COLUMN feature_group_id TEXT');
    }

    // Add new columns to jira_config for multi-board support
    const jiraConfigColumns = this.db.prepare("PRAGMA table_info(jira_config)").all() as { name: string }[];
    const jiraConfigColumnNames = jiraConfigColumns.map((c) => c.name);

    if (!jiraConfigColumnNames.includes('team_name')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN team_name TEXT');
    }
    if (!jiraConfigColumnNames.includes('default_board_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN default_board_id INTEGER');
    }
    if (!jiraConfigColumnNames.includes('design_board_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN design_board_id INTEGER');
    }
    if (!jiraConfigColumnNames.includes('work_type_field_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN work_type_field_id TEXT');
    }
    if (!jiraConfigColumnNames.includes('team_field_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN team_field_id TEXT');
    }
    if (!jiraConfigColumnNames.includes('team_value')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN team_value TEXT');
    }
    if (!jiraConfigColumnNames.includes('regression_field_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN regression_field_id TEXT');
    }
    if (!jiraConfigColumnNames.includes('regression_default_value')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN regression_default_value TEXT');
    }
    if (!jiraConfigColumnNames.includes('sprint_field_id')) {
      this.db.exec('ALTER TABLE jira_config ADD COLUMN sprint_field_id TEXT');
    }

    // Create jira_sprints table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jira_sprints (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('active', 'future', 'closed')),
        start_date TEXT,
        end_date TEXT,
        board_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Add RTS-related columns to team_members
    const teamMemberColumns = this.db.prepare("PRAGMA table_info(team_members)").all() as { name: string }[];
    const teamMemberColumnNames = teamMemberColumns.map((c) => c.name);

    if (!teamMemberColumnNames.includes('member_type')) {
      this.db.exec("ALTER TABLE team_members ADD COLUMN member_type TEXT NOT NULL DEFAULT 'human'");
    }
    if (!teamMemberColumnNames.includes('position_x')) {
      this.db.exec('ALTER TABLE team_members ADD COLUMN position_x REAL');
    }
    if (!teamMemberColumnNames.includes('position_y')) {
      this.db.exec('ALTER TABLE team_members ADD COLUMN position_y REAL');
    }
    if (!teamMemberColumnNames.includes('jira_account_id')) {
      this.db.exec('ALTER TABLE team_members ADD COLUMN jira_account_id TEXT');
    }
    if (!teamMemberColumnNames.includes('bitbucket_username')) {
      this.db.exec('ALTER TABLE team_members ADD COLUMN bitbucket_username TEXT');
    }
    if (!teamMemberColumnNames.includes('slack_user_id')) {
      this.db.exec('ALTER TABLE team_members ADD COLUMN slack_user_id TEXT');
    }

    // Initialize world_config with default if not exists
    const worldConfigExists = this.db.prepare("SELECT COUNT(*) as count FROM world_config WHERE id = 'default'").get() as { count: number };
    if (worldConfigExists.count === 0) {
      this.db.exec("INSERT INTO world_config (id) VALUES ('default')");
    }

    // Initialize jira_sync_state singleton if not exists
    const syncStateExists = this.db.prepare("SELECT COUNT(*) as count FROM jira_sync_state WHERE id = 'singleton'").get() as { count: number };
    if (syncStateExists.count === 0) {
      this.db.exec("INSERT INTO jira_sync_state (id) VALUES ('singleton')");
    }

    // Initialize bitbucket_sync_state singleton if not exists
    const bbSyncStateExists = this.db.prepare("SELECT COUNT(*) as count FROM bitbucket_sync_state WHERE id = 'singleton'").get() as { count: number };
    if (bbSyncStateExists.count === 0) {
      this.db.exec("INSERT INTO bitbucket_sync_state (id) VALUES ('singleton')");
    }
  }

  private runNumberedMigrations() {
    const migrationsDir = join(__dirname, '../db/migrations');
    let files: string[];
    try {
      files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    } catch {
      // migrations directory doesn't exist yet
      return;
    }

    const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM migrations WHERE name = ?');
    const insertStmt = this.db.prepare('INSERT INTO migrations (name) VALUES (?)');

    for (const file of files) {
      const { count } = checkStmt.get(file) as { count: number };
      if (count === 0) {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        this.db.exec(sql);
        insertStmt.run(file);
        console.log(`[migrations] Applied: ${file}`);
      }
    }
  }

  // Ticket methods
  createTicket(input: CreateTicketInput): Ticket {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO tickets (id, title, description, acceptance_criteria, ticket_type, priority, epic_id, assignee_id, labels, required_skills, feature_group_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      input.title,
      input.description,
      JSON.stringify(input.acceptanceCriteria),
      input.ticketType,
      input.priority,
      input.epicId ?? null,
      input.assigneeId ?? null,
      JSON.stringify(input.labels ?? []),
      JSON.stringify(input.requiredSkills ?? []),
      input.featureGroupId ?? null,
      now,
      now
    );
    return this.getTicket(id)!;
  }

  createTickets(inputs: CreateTicketInput[]): Ticket[] {
    const insertMany = this.db.transaction((tickets: CreateTicketInput[]) => {
      return tickets.map((input) => this.createTicket(input));
    });
    return insertMany(inputs);
  }

  getTicket(id: string): Ticket | null {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapTicketRow(row) : null;
  }

  getTickets(filters?: { status?: TicketStatus; epicId?: string; assigneeId?: string }): Ticket[] {
    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.epicId) {
      query += ' AND epic_id = ?';
      params.push(filters.epicId);
    }
    if (filters?.assigneeId) {
      query += ' AND assignee_id = ?';
      params.push(filters.assigneeId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapTicketRow);
  }

  updateTicket(id: string, input: UpdateTicketInput): Ticket | null {
    const existing = this.getTicket(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }
    if (input.acceptanceCriteria !== undefined) {
      updates.push('acceptance_criteria = ?');
      params.push(JSON.stringify(input.acceptanceCriteria));
    }
    if (input.ticketType !== undefined) {
      updates.push('ticket_type = ?');
      params.push(input.ticketType);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }
    if (input.epicId !== undefined) {
      updates.push('epic_id = ?');
      params.push(input.epicId);
    }
    if (input.assigneeId !== undefined) {
      updates.push('assignee_id = ?');
      params.push(input.assigneeId);
    }
    if (input.labels !== undefined) {
      updates.push('labels = ?');
      params.push(JSON.stringify(input.labels));
    }
    if (input.requiredSkills !== undefined) {
      updates.push('required_skills = ?');
      params.push(JSON.stringify(input.requiredSkills));
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.createdInJira !== undefined) {
      updates.push('created_in_jira = ?');
      params.push(input.createdInJira ? 1 : 0);
    }
    if (input.jiraKey !== undefined) {
      updates.push('jira_key = ?');
      params.push(input.jiraKey);
    }
    if (input.jiraUrl !== undefined) {
      updates.push('jira_url = ?');
      params.push(input.jiraUrl);
    }
    if (input.featureGroupId !== undefined) {
      updates.push('feature_group_id = ?');
      params.push(input.featureGroupId);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getTicket(id);
  }

  deleteTicket(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tickets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getTicketsByFeatureGroup(featureGroupId: string): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE feature_group_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(featureGroupId) as any[];
    return rows.map(this.mapTicketRow);
  }

  getTicketByJiraKey(jiraKey: string): Ticket | null {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE jira_key = ?');
    const row = stmt.get(jiraKey) as any;
    return row ? this.mapTicketRow(row) : null;
  }

  upsertJiraTicket(data: {
    jiraKey: string;
    title: string;
    description: string;
    assigneeId: string | null;
    status: string;  // Jira status (not used for internal status)
    priority: string;
  }): void {
    const existing = this.getTicketByJiraKey(data.jiraKey);
    // Use 'created' as internal status (matches schema constraint)
    // Jira status strings like "In Progress", "To Do" don't match our schema
    const internalStatus = 'created';

    if (existing) {
      // Update existing ticket
      const stmt = this.db.prepare(`
        UPDATE tickets
        SET title = ?, description = ?, assignee_id = ?,
            status = ?, priority = ?, jira_status = ?, updated_at = ?
        WHERE jira_key = ?
      `);
      stmt.run(data.title, data.description, data.assigneeId,
               internalStatus, data.priority, data.status, new Date().toISOString(), data.jiraKey);
    } else {
      // Insert new ticket
      const id = uuidv4();
      const stmt = this.db.prepare(`
        INSERT INTO tickets (id, title, description, assignee_id, jira_key,
                            status, priority, jira_status, acceptance_criteria, ticket_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      stmt.run(id, data.title, data.description, data.assigneeId, data.jiraKey,
               internalStatus, data.priority, data.status, '[]', 'task', now, now);
    }
  }

  private mapTicketRow(row: any): Ticket {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      acceptanceCriteria: JSON.parse(row.acceptance_criteria),
      ticketType: row.ticket_type,
      priority: row.priority,
      epicId: row.epic_id,
      assigneeId: row.assignee_id,
      labels: JSON.parse(row.labels || '[]'),
      requiredSkills: JSON.parse(row.required_skills || '[]'),
      status: row.status,
      createdInJira: Boolean(row.created_in_jira),
      jiraKey: row.jira_key ?? undefined,
      jiraUrl: row.jira_url ?? undefined,
      jiraStatus: row.jira_status ?? undefined,
      featureGroupId: row.feature_group_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Team Member methods
  createTeamMember(input: CreateTeamMemberInput): TeamMember {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO team_members (id, name, role, skills, jira_username, jira_account_id, bitbucket_username, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.role, JSON.stringify(input.skills), input.jiraUsername ?? null, input.jiraAccountId ?? null, input.bitbucketUsername ?? null, now, now);
    return this.getTeamMember(id)!;
  }

  getTeamMember(id: string): TeamMember | null {
    const stmt = this.db.prepare('SELECT * FROM team_members WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapTeamMemberRow(row) : null;
  }

  getTeamMembers(): TeamMember[] {
    const stmt = this.db.prepare('SELECT * FROM team_members ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(this.mapTeamMemberRow);
  }

  updateTeamMember(id: string, input: UpdateTeamMemberInput): TeamMember | null {
    const existing = this.getTeamMember(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.role !== undefined) {
      updates.push('role = ?');
      params.push(input.role);
    }
    if (input.skills !== undefined) {
      updates.push('skills = ?');
      params.push(JSON.stringify(input.skills));
    }
    if (input.jiraUsername !== undefined) {
      updates.push('jira_username = ?');
      params.push(input.jiraUsername);
    }
    if (input.jiraAccountId !== undefined) {
      updates.push('jira_account_id = ?');
      params.push(input.jiraAccountId);
    }
    if (input.bitbucketUsername !== undefined) {
      updates.push('bitbucket_username = ?');
      params.push(input.bitbucketUsername);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getTeamMember(id);
  }

  deleteTeamMember(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM team_members WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getTeamMemberByJiraUsername(username: string): TeamMember | null {
    const stmt = this.db.prepare('SELECT * FROM team_members WHERE jira_username = ?');
    const row = stmt.get(username) as any;
    return row ? this.mapTeamMemberRow(row) : null;
  }

  syncTeamMembersFromJira(members: { displayName: string; jiraUsername?: string; jiraAccountId: string }[]): {
    updated: number;
    created: number;
    skipped: number;
  } {
    let updated = 0;
    let created = 0;
    let skipped = 0;

    const syncAll = this.db.transaction((memberList) => {
      for (const input of memberList) {
        if (!input.jiraAccountId) {
          skipped++;
          continue;
        }

        // First try to match by jiraAccountId
        const byAccountId = this.db.prepare('SELECT * FROM team_members WHERE jira_account_id = ?').get(input.jiraAccountId) as any;
        if (byAccountId) {
          updated++;
          continue;
        }

        // Then try to match by jiraUsername
        const byUsername = input.jiraUsername ? this.getTeamMemberByJiraUsername(input.jiraUsername) : null;
        if (byUsername) {
          this.db.prepare(`
            UPDATE team_members
            SET jira_account_id = ?, updated_at = ?
            WHERE id = ?
          `).run(input.jiraAccountId, new Date().toISOString(), byUsername.id);
          updated++;
          continue;
        }

        // No match found — create a new team member
        this.createTeamMember({
          name: input.displayName,
          role: 'Software Engineer',
          skills: [],
          jiraUsername: input.displayName,
          jiraAccountId: input.jiraAccountId,
        });
        created++;
      }
    });

    syncAll(members);
    return { updated, created, skipped };
  }

  private mapTeamMemberRow(row: any): TeamMember {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      skills: JSON.parse(row.skills),
      jiraUsername: row.jira_username ?? undefined,
      jiraAccountId: row.jira_account_id ?? undefined,
      bitbucketUsername: row.bitbucket_username ?? undefined,
      memberType: row.member_type || 'human',
      position: row.position_x != null && row.position_y != null
        ? { x: row.position_x, y: row.position_y }
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Epic methods
  createEpic(input: CreateEpicInput): Epic {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO epics (id, name, key, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.key, input.description, now, now);
    return this.getEpic(id)!;
  }

  getEpic(id: string): Epic | null {
    const stmt = this.db.prepare('SELECT * FROM epics WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapEpicRow(row) : null;
  }

  getEpics(): Epic[] {
    const stmt = this.db.prepare('SELECT * FROM epics ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(this.mapEpicRow);
  }

  updateEpic(id: string, input: UpdateEpicInput): Epic | null {
    const existing = this.getEpic(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.key !== undefined) {
      updates.push('key = ?');
      params.push(input.key);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`UPDATE epics SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getEpic(id);
  }

  deleteEpic(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM epics WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapEpicRow(row: any): Epic {
    return {
      id: row.id,
      name: row.name,
      key: row.key,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Jira Config methods
  getJiraConfig(): JiraConfig | null {
    const stmt = this.db.prepare('SELECT * FROM jira_config LIMIT 1');
    const row = stmt.get() as any;
    return row ? this.mapJiraConfigRow(row) : null;
  }

  updateJiraConfig(input: JiraConfigInput): JiraConfig {
    const existing = this.getJiraConfig();
    const now = new Date().toISOString();

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE jira_config
        SET base_url = ?, project_key = ?, epic_link_field = ?, team_name = ?,
            default_board_id = ?, design_board_id = ?, work_type_field_id = ?,
            team_field_id = ?, team_value = ?, regression_field_id = ?,
            regression_default_value = ?, sprint_field_id = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(
        input.baseUrl,
        input.projectKey,
        input.epicLinkField ?? null,
        input.teamName ?? null,
        input.defaultBoardId ?? null,
        input.designBoardId ?? null,
        input.workTypeFieldId ?? null,
        input.teamFieldId ?? null,
        input.teamValue ?? null,
        input.regressionFieldId ?? null,
        input.regressionDefaultValue ?? null,
        input.sprintFieldId ?? null,
        now,
        existing.id
      );
      return this.getJiraConfig()!;
    } else {
      const id = uuidv4();
      const stmt = this.db.prepare(`
        INSERT INTO jira_config (id, base_url, project_key, epic_link_field, team_name,
                                 default_board_id, design_board_id, work_type_field_id,
                                 team_field_id, team_value, regression_field_id,
                                 regression_default_value, sprint_field_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        input.baseUrl,
        input.projectKey,
        input.epicLinkField ?? null,
        input.teamName ?? null,
        input.defaultBoardId ?? null,
        input.designBoardId ?? null,
        input.workTypeFieldId ?? null,
        input.teamFieldId ?? null,
        input.teamValue ?? null,
        input.regressionFieldId ?? null,
        input.regressionDefaultValue ?? null,
        input.sprintFieldId ?? null,
        now,
        now
      );
      return this.getJiraConfig()!;
    }
  }

  private mapJiraConfigRow(row: any): JiraConfig {
    return {
      id: row.id,
      baseUrl: row.base_url,
      projectKey: row.project_key,
      epicLinkField: row.epic_link_field ?? undefined,
      teamName: row.team_name ?? undefined,
      defaultBoardId: row.default_board_id ?? undefined,
      designBoardId: row.design_board_id ?? undefined,
      workTypeFieldId: row.work_type_field_id ?? undefined,
      teamFieldId: row.team_field_id ?? undefined,
      teamValue: row.team_value ?? undefined,
      regressionFieldId: row.regression_field_id ?? undefined,
      regressionDefaultValue: row.regression_default_value ?? undefined,
      sprintFieldId: row.sprint_field_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Sprint cache methods
  getSprints(boardId?: number): JiraSprint[] {
    let query = 'SELECT * FROM jira_sprints';
    const params: any[] = [];

    if (boardId !== undefined) {
      query += ' WHERE board_id = ?';
      params.push(boardId);
    }

    query += ' ORDER BY state ASC, name ASC'; // active first, then future, then closed

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapSprintRow);
  }

  setSprints(sprints: JiraSprint[]): void {
    const now = new Date().toISOString();

    // Use transaction for efficiency
    const insertMany = this.db.transaction((sprintList: JiraSprint[]) => {
      const upsertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO jira_sprints (id, name, state, start_date, end_date, board_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM jira_sprints WHERE id = ?), ?), ?)
      `);

      for (const sprint of sprintList) {
        upsertStmt.run(
          sprint.id,
          sprint.name,
          sprint.state,
          sprint.startDate ?? null,
          sprint.endDate ?? null,
          sprint.boardId,
          sprint.id, // for COALESCE lookup
          now,
          now
        );
      }
    });

    insertMany(sprints);
  }

  clearSprints(boardId?: number): void {
    if (boardId !== undefined) {
      const stmt = this.db.prepare('DELETE FROM jira_sprints WHERE board_id = ?');
      stmt.run(boardId);
    } else {
      this.db.exec('DELETE FROM jira_sprints');
    }
  }

  private mapSprintRow(row: any): JiraSprint {
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      boardId: row.board_id,
    };
  }

  // Sync methods for replacing data from Jira
  replaceTeamMembers(members: CreateTeamMemberInput[]): TeamMember[] {
    const insertMembers = this.db.transaction((memberList: CreateTeamMemberInput[]) => {
      // Clear existing team members
      this.db.exec('DELETE FROM team_members');

      // Insert new members
      return memberList.map((input) => this.createTeamMember(input));
    });

    return insertMembers(members);
  }

  replaceEpics(epics: CreateEpicInput[]): Epic[] {
    const insertEpics = this.db.transaction((epicList: CreateEpicInput[]) => {
      // Clear existing epics (but preserve foreign key references by setting to null)
      this.db.exec('UPDATE tickets SET epic_id = NULL');
      this.db.exec('DELETE FROM epics');

      // Insert new epics
      return epicList.map((input) => this.createEpic(input));
    });

    return insertEpics(epics);
  }

  // Agent Knowledge methods
  getAgentKnowledge(type?: KnowledgeType): AgentKnowledge[] {
    let query = 'SELECT * FROM agent_knowledge';
    const params: any[] = [];

    if (type) {
      query += ' WHERE knowledge_type = ?';
      params.push(type);
    }

    query += ' ORDER BY confidence DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapAgentKnowledgeRow);
  }

  saveAgentKnowledge(knowledge: Omit<AgentKnowledge, 'lastUpdated'>): AgentKnowledge {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_knowledge (id, knowledge_type, key, value, confidence, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(knowledge.id, knowledge.knowledgeType, knowledge.key, knowledge.value, knowledge.confidence, now);

    return { ...knowledge, lastUpdated: now };
  }

  clearAgentKnowledge(type?: KnowledgeType): void {
    if (type) {
      const stmt = this.db.prepare('DELETE FROM agent_knowledge WHERE knowledge_type = ?');
      stmt.run(type);
    } else {
      this.db.exec('DELETE FROM agent_knowledge');
    }
  }

  private mapAgentKnowledgeRow(row: any): AgentKnowledge {
    return {
      id: row.id,
      knowledgeType: row.knowledge_type,
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      lastUpdated: row.last_updated,
    };
  }

  // Inferred Skills methods
  getInferredSkills(teamMemberId?: string): InferredSkill[] {
    let query = 'SELECT * FROM team_member_skills_inferred';
    const params: any[] = [];

    if (teamMemberId) {
      query += ' WHERE team_member_id = ?';
      params.push(teamMemberId);
    }

    query += ' ORDER BY confidence DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapInferredSkillRow);
  }

  saveInferredSkill(skill: Omit<InferredSkill, 'lastUpdated'>): InferredSkill {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO team_member_skills_inferred (id, team_member_id, skill, confidence, evidence, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(skill.id, skill.teamMemberId, skill.skill, skill.confidence, skill.evidence, now);

    return { ...skill, lastUpdated: now };
  }

  saveInferredSkills(skills: Omit<InferredSkill, 'lastUpdated'>[]): InferredSkill[] {
    const now = new Date().toISOString();
    const saveMany = this.db.transaction((skillList: Omit<InferredSkill, 'lastUpdated'>[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO team_member_skills_inferred (id, team_member_id, skill, confidence, evidence, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      return skillList.map((skill) => {
        stmt.run(skill.id, skill.teamMemberId, skill.skill, skill.confidence, skill.evidence, now);
        return { ...skill, lastUpdated: now };
      });
    });

    return saveMany(skills);
  }

  clearInferredSkills(teamMemberId?: string): void {
    if (teamMemberId) {
      const stmt = this.db.prepare('DELETE FROM team_member_skills_inferred WHERE team_member_id = ?');
      stmt.run(teamMemberId);
    } else {
      this.db.exec('DELETE FROM team_member_skills_inferred');
    }
  }

  private mapInferredSkillRow(row: any): InferredSkill {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      skill: row.skill,
      confidence: row.confidence,
      evidence: row.evidence,
      lastUpdated: row.last_updated,
    };
  }

  // Epic Categories methods
  getEpicCategories(epicId?: string): EpicCategory[] {
    let query = 'SELECT * FROM epic_categories';
    const params: any[] = [];

    if (epicId) {
      query += ' WHERE epic_id = ?';
      params.push(epicId);
    }

    query += ' ORDER BY category';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapEpicCategoryRow);
  }

  saveEpicCategory(category: Omit<EpicCategory, 'lastUpdated'>): EpicCategory {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO epic_categories (id, epic_id, category, keywords, last_updated)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(category.id, category.epicId, category.category, JSON.stringify(category.keywords), now);

    return { ...category, lastUpdated: now };
  }

  saveEpicCategories(categories: Omit<EpicCategory, 'lastUpdated'>[]): EpicCategory[] {
    const now = new Date().toISOString();
    const saveMany = this.db.transaction((categoryList: Omit<EpicCategory, 'lastUpdated'>[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO epic_categories (id, epic_id, category, keywords, last_updated)
        VALUES (?, ?, ?, ?, ?)
      `);

      return categoryList.map((category) => {
        stmt.run(category.id, category.epicId, category.category, JSON.stringify(category.keywords), now);
        return { ...category, lastUpdated: now };
      });
    });

    return saveMany(categories);
  }

  clearEpicCategories(epicId?: string): void {
    if (epicId) {
      const stmt = this.db.prepare('DELETE FROM epic_categories WHERE epic_id = ?');
      stmt.run(epicId);
    } else {
      this.db.exec('DELETE FROM epic_categories');
    }
  }

  private mapEpicCategoryRow(row: any): EpicCategory {
    return {
      id: row.id,
      epicId: row.epic_id,
      category: row.category,
      keywords: JSON.parse(row.keywords || '[]'),
      lastUpdated: row.last_updated,
    };
  }

  // Ticket Enhancements methods
  getTicketEnhancements(ticketId: string): TicketEnhancements | null {
    const stmt = this.db.prepare('SELECT * FROM ticket_enhancements WHERE ticket_id = ?');
    const row = stmt.get(ticketId) as any;
    return row ? this.mapTicketEnhancementsRow(row) : null;
  }

  saveTicketEnhancements(ticketId: string, enhancements: TicketEnhancements): void {
    const now = new Date().toISOString();
    const id = `${ticketId}-enhancements`;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ticket_enhancements
      (id, ticket_id, original_description, enhanced_description, added_acceptance_criteria,
       success_metrics, technical_context, ai_coding_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM ticket_enhancements WHERE id = ?), ?), ?)
    `);
    stmt.run(
      id,
      ticketId,
      enhancements.originalDescription,
      enhancements.enhancedDescription,
      JSON.stringify(enhancements.addedAcceptanceCriteria),
      JSON.stringify(enhancements.successMetrics),
      enhancements.technicalContext,
      enhancements.aiCodingNotes ?? null,
      id,
      now,
      now
    );
  }

  private mapTicketEnhancementsRow(row: any): TicketEnhancements {
    return {
      originalDescription: row.original_description,
      enhancedDescription: row.enhanced_description,
      addedAcceptanceCriteria: JSON.parse(row.added_acceptance_criteria || '[]'),
      successMetrics: JSON.parse(row.success_metrics || '[]'),
      technicalContext: row.technical_context,
      aiCodingNotes: row.ai_coding_notes ?? undefined,
    };
  }

  // Pending Epic Proposals methods
  getPendingEpicProposals(status?: 'pending' | 'approved' | 'rejected'): {
    id: string;
    ticketId: string;
    proposedName: string;
    proposedKey: string;
    proposedDescription: string;
    confidence: number;
    reasoning: string;
    status: string;
    createdAt: string;
  }[] {
    let query = 'SELECT * FROM pending_epic_proposals';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      proposedName: row.proposed_name,
      proposedKey: row.proposed_key,
      proposedDescription: row.proposed_description,
      confidence: row.confidence,
      reasoning: row.reasoning,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  getPendingEpicProposal(id: string): {
    id: string;
    ticketId: string;
    proposedName: string;
    proposedKey: string;
    proposedDescription: string;
    confidence: number;
    reasoning: string;
    status: string;
    createdAt: string;
  } | null {
    const stmt = this.db.prepare('SELECT * FROM pending_epic_proposals WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      ticketId: row.ticket_id,
      proposedName: row.proposed_name,
      proposedKey: row.proposed_key,
      proposedDescription: row.proposed_description,
      confidence: row.confidence,
      reasoning: row.reasoning,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  savePendingEpicProposal(ticketId: string, suggestion: EpicSuggestion): string {
    const id = uuidv4();
    const now = new Date().toISOString();

    if (!suggestion.newEpicProposal) {
      throw new Error('Cannot save pending epic proposal without newEpicProposal');
    }

    const stmt = this.db.prepare(`
      INSERT INTO pending_epic_proposals
      (id, ticket_id, proposed_name, proposed_key, proposed_description, confidence, reasoning, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);
    stmt.run(
      id,
      ticketId,
      suggestion.newEpicProposal.name,
      suggestion.newEpicProposal.key,
      suggestion.newEpicProposal.description,
      suggestion.confidence,
      suggestion.reasoning,
      now,
      now
    );

    return id;
  }

  updatePendingEpicProposal(id: string, updates: { status?: 'pending' | 'approved' | 'rejected' }): void {
    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }

    if (updateFields.length === 0) return;

    updateFields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = this.db.prepare(`UPDATE pending_epic_proposals SET ${updateFields.join(', ')} WHERE id = ?`);
    stmt.run(...params);
  }

  // ============================================================================
  // Member Progress Methods
  // ============================================================================

  getMemberProgress(teamMemberId: string): MemberProgress | null {
    const stmt = this.db.prepare('SELECT * FROM member_progress WHERE team_member_id = ?');
    const row = stmt.get(teamMemberId) as any;
    return row ? this.mapMemberProgressRow(row) : null;
  }

  getAllMemberProgress(): MemberProgress[] {
    const stmt = this.db.prepare('SELECT * FROM member_progress ORDER BY xp DESC');
    const rows = stmt.all() as any[];
    return rows.map(this.mapMemberProgressRow);
  }

  getOrCreateMemberProgress(teamMemberId: string): MemberProgress {
    let progress = this.getMemberProgress(teamMemberId);
    if (!progress) {
      const id = uuidv4();
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO member_progress (id, team_member_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, teamMemberId, now, now);
      progress = this.getMemberProgress(teamMemberId)!;
    }
    return progress;
  }

  updateMemberProgress(teamMemberId: string, updates: { xp?: number; level?: number; title?: string; ticketsCompleted?: number }): MemberProgress | null {
    const existing = this.getOrCreateMemberProgress(teamMemberId);
    if (!existing) return null;

    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.xp !== undefined) {
      updateFields.push('xp = ?');
      params.push(updates.xp);
    }
    if (updates.level !== undefined) {
      updateFields.push('level = ?');
      params.push(updates.level);
    }
    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.ticketsCompleted !== undefined) {
      updateFields.push('tickets_completed = ?');
      params.push(updates.ticketsCompleted);
    }

    if (updateFields.length === 0) return existing;

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(teamMemberId);

    const stmt = this.db.prepare(`UPDATE member_progress SET ${updateFields.join(', ')} WHERE team_member_id = ?`);
    stmt.run(...params);
    return this.getMemberProgress(teamMemberId);
  }

  addMemberXP(teamMemberId: string, amount: number): MemberProgress {
    const progress = this.getOrCreateMemberProgress(teamMemberId);
    const newXP = progress.xp + amount;
    const { level, title } = this.calculateLevelFromXP(newXP);

    const didLevelUp = level > progress.level;

    this.updateMemberProgress(teamMemberId, { xp: newXP, level, title });

    if (didLevelUp) {
      this.createLevelUpEvent('member', teamMemberId, progress.level, level, title);
    }

    return this.getMemberProgress(teamMemberId)!;
  }

  private calculateLevelFromXP(xp: number): { level: number; title: string } {
    const levels = [
      { level: 1, xp: 0, title: 'Recruit' },
      { level: 2, xp: 200, title: 'Squire' },
      { level: 3, xp: 500, title: 'Adventurer' },
      { level: 4, xp: 1000, title: 'Veteran' },
      { level: 5, xp: 2000, title: 'Champion' },
      { level: 6, xp: 4000, title: 'Hero' },
      { level: 7, xp: 7000, title: 'Legend' },
      { level: 8, xp: 10000, title: 'Mythic' },
      { level: 9, xp: 15000, title: 'Paragon' },
      { level: 10, xp: 25000, title: 'Ascended' },
    ];

    for (let i = levels.length - 1; i >= 0; i--) {
      if (xp >= levels[i].xp) {
        return { level: levels[i].level, title: levels[i].title };
      }
    }
    return { level: 1, title: 'Recruit' };
  }

  private mapMemberProgressRow(row: any): MemberProgress {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      xp: row.xp,
      level: row.level,
      title: row.title,
      ticketsCompleted: row.tickets_completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Jira Sync State Methods
  // ============================================================================

  getJiraSyncState(): JiraSyncState {
    const stmt = this.db.prepare("SELECT * FROM jira_sync_state WHERE id = 'singleton'");
    const row = stmt.get() as any;
    return this.mapJiraSyncStateRow(row);
  }

  updateJiraSyncState(updates: UpdateJiraSyncConfigInput & {
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    errorCount?: number;
    lastError?: string | null;
  }): JiraSyncState {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.syncIntervalMs !== undefined) {
      updateFields.push('sync_interval_ms = ?');
      params.push(updates.syncIntervalMs);
    }
    if (updates.syncEnabled !== undefined) {
      updateFields.push('sync_enabled = ?');
      params.push(updates.syncEnabled ? 1 : 0);
    }
    if (updates.baselineDate !== undefined) {
      updateFields.push('baseline_date = ?');
      params.push(updates.baselineDate);
    }
    if (updates.lastSyncAt !== undefined) {
      updateFields.push('last_sync_at = ?');
      params.push(updates.lastSyncAt);
    }
    if (updates.lastSuccessfulSyncAt !== undefined) {
      updateFields.push('last_successful_sync_at = ?');
      params.push(updates.lastSuccessfulSyncAt);
    }
    if (updates.errorCount !== undefined) {
      updateFields.push('error_count = ?');
      params.push(updates.errorCount);
    }
    if (updates.lastError !== undefined) {
      updateFields.push('last_error = ?');
      params.push(updates.lastError);
    }

    if (updateFields.length === 0) return this.getJiraSyncState();

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    const stmt = this.db.prepare(`UPDATE jira_sync_state SET ${updateFields.join(', ')} WHERE id = 'singleton'`);
    stmt.run(...params);
    return this.getJiraSyncState();
  }

  private mapJiraSyncStateRow(row: any): JiraSyncState {
    return {
      id: row.id,
      lastSyncAt: row.last_sync_at ?? null,
      lastSuccessfulSyncAt: row.last_successful_sync_at ?? null,
      syncIntervalMs: row.sync_interval_ms,
      syncEnabled: Boolean(row.sync_enabled),
      baselineDate: row.baseline_date ?? null,
      errorCount: row.error_count,
      lastError: row.last_error ?? null,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // World Config Methods
  // ============================================================================

  getWorldConfig(): WorldConfig {
    const stmt = this.db.prepare("SELECT * FROM world_config WHERE id = 'default'");
    const row = stmt.get() as any;
    return this.mapWorldConfigRow(row);
  }

  updateWorldConfig(updates: UpdateWorldConfigInput): WorldConfig {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.width !== undefined) {
      updateFields.push('width = ?');
      params.push(updates.width);
    }
    if (updates.height !== undefined) {
      updateFields.push('height = ?');
      params.push(updates.height);
    }
    if (updates.basecampX !== undefined) {
      updateFields.push('basecamp_x = ?');
      params.push(updates.basecampX);
    }
    if (updates.basecampY !== undefined) {
      updateFields.push('basecamp_y = ?');
      params.push(updates.basecampY);
    }

    if (updateFields.length === 0) return this.getWorldConfig();

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    const stmt = this.db.prepare(`UPDATE world_config SET ${updateFields.join(', ')} WHERE id = 'default'`);
    stmt.run(...params);
    return this.getWorldConfig();
  }

  private mapWorldConfigRow(row: any): WorldConfig {
    return {
      id: row.id,
      width: row.width,
      height: row.height,
      basecamp: { x: row.basecamp_x, y: row.basecamp_y },
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Campaign Region Methods
  // ============================================================================

  getCampaignRegions(): CampaignRegion[] {
    const stmt = this.db.prepare('SELECT * FROM campaign_regions ORDER BY created_at');
    const rows = stmt.all() as any[];
    return rows.map(this.mapCampaignRegionRow);
  }

  getCampaignRegion(id: string): CampaignRegion | null {
    const stmt = this.db.prepare('SELECT * FROM campaign_regions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapCampaignRegionRow(row) : null;
  }

  getCampaignRegionByEpic(epicId: string): CampaignRegion | null {
    const stmt = this.db.prepare('SELECT * FROM campaign_regions WHERE epic_id = ?');
    const row = stmt.get(epicId) as any;
    return row ? this.mapCampaignRegionRow(row) : null;
  }

  createCampaignRegion(input: CreateCampaignRegionInput): CampaignRegion {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO campaign_regions (id, epic_id, x, y, width, height, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.epicId, input.x, input.y, input.width, input.height, input.color || '#4A4136', now);
    return this.getCampaignRegion(id)!;
  }

  updateCampaignRegion(id: string, updates: Partial<CreateCampaignRegionInput>): CampaignRegion | null {
    const existing = this.getCampaignRegion(id);
    if (!existing) return null;

    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.x !== undefined) {
      updateFields.push('x = ?');
      params.push(updates.x);
    }
    if (updates.y !== undefined) {
      updateFields.push('y = ?');
      params.push(updates.y);
    }
    if (updates.width !== undefined) {
      updateFields.push('width = ?');
      params.push(updates.width);
    }
    if (updates.height !== undefined) {
      updateFields.push('height = ?');
      params.push(updates.height);
    }
    if (updates.color !== undefined) {
      updateFields.push('color = ?');
      params.push(updates.color);
    }

    if (updateFields.length === 0) return existing;

    params.push(id);
    const stmt = this.db.prepare(`UPDATE campaign_regions SET ${updateFields.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getCampaignRegion(id);
  }

  deleteCampaignRegion(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM campaign_regions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapCampaignRegionRow(row: any): CampaignRegion {
    return {
      id: row.id,
      epicId: row.epic_id,
      bounds: { x: row.x, y: row.y, width: row.width, height: row.height },
      color: row.color,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Ticket Completion Methods
  // ============================================================================

  getTicketCompletion(jiraKey: string): TicketCompletion | null {
    const stmt = this.db.prepare('SELECT * FROM ticket_completions WHERE jira_key = ?');
    const row = stmt.get(jiraKey) as any;
    return row ? this.mapTicketCompletionRow(row) : null;
  }

  getTicketCompletions(teamMemberId?: string): TicketCompletion[] {
    let query = 'SELECT * FROM ticket_completions';
    const params: any[] = [];

    if (teamMemberId) {
      query += ' WHERE team_member_id = ?';
      params.push(teamMemberId);
    }

    query += ' ORDER BY completed_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapTicketCompletionRow);
  }

  recordTicketCompletion(jiraKey: string, teamMemberId: string | null, xpAwarded: number, source: 'jira_sync' | 'manual'): TicketCompletion | null {
    // Check if already recorded
    const existing = this.getTicketCompletion(jiraKey);
    if (existing) return null; // Already recorded, prevent duplicate XP

    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO ticket_completions (id, jira_key, team_member_id, completed_at, xp_awarded, completion_source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, jiraKey, teamMemberId, now, xpAwarded, source, now);

    // Update member progress if we have an assignee
    if (teamMemberId) {
      const progress = this.getOrCreateMemberProgress(teamMemberId);
      this.updateMemberProgress(teamMemberId, { ticketsCompleted: progress.ticketsCompleted + 1 });
      this.addMemberXP(teamMemberId, xpAwarded);
    }

    return this.getTicketCompletion(jiraKey);
  }

  private mapTicketCompletionRow(row: any): TicketCompletion {
    return {
      id: row.id,
      jiraKey: row.jira_key,
      teamMemberId: row.team_member_id ?? null,
      completedAt: row.completed_at,
      xpAwarded: row.xp_awarded,
      completionSource: row.completion_source,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Level Up Event Methods
  // ============================================================================

  createLevelUpEvent(entityType: 'member' | 'ai', entityId: string, oldLevel: number, newLevel: number, newTitle: string): LevelUpEvent {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO level_up_events (id, entity_type, entity_id, old_level, new_level, new_title, triggered_at, acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(id, entityType, entityId, oldLevel, newLevel, newTitle, now);
    return this.getLevelUpEvent(id)!;
  }

  getLevelUpEvent(id: string): LevelUpEvent | null {
    const stmt = this.db.prepare('SELECT * FROM level_up_events WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapLevelUpEventRow(row) : null;
  }

  getUnacknowledgedLevelUpEvents(): LevelUpEvent[] {
    const stmt = this.db.prepare('SELECT * FROM level_up_events WHERE acknowledged = 0 ORDER BY triggered_at ASC');
    const rows = stmt.all() as any[];
    return rows.map(this.mapLevelUpEventRow);
  }

  acknowledgeLevelUpEvent(id: string): void {
    const stmt = this.db.prepare('UPDATE level_up_events SET acknowledged = 1 WHERE id = ?');
    stmt.run(id);
  }

  private mapLevelUpEventRow(row: any): LevelUpEvent {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldLevel: row.old_level,
      newLevel: row.new_level,
      newTitle: row.new_title,
      triggeredAt: row.triggered_at,
      acknowledged: Boolean(row.acknowledged),
    };
  }

  // ============================================================================
  // Member Position Methods
  // ============================================================================

  updateMemberPosition(teamMemberId: string, position: UpdateMemberPositionInput): TeamMember | null {
    const existing = this.getTeamMember(teamMemberId);
    if (!existing) return null;

    const stmt = this.db.prepare(`
      UPDATE team_members SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(position.x, position.y, new Date().toISOString(), teamMemberId);
    return this.getTeamMember(teamMemberId);
  }

  // ============================================================================
  // PM Assignment Methods
  // ============================================================================

  createPMAssignment(input: CreatePMAssignmentInput): PMAssignment {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO pm_assignments (id, ticket_id, jira_key, assignee_id, assigned_by, assigned_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      input.ticketId ?? null,
      input.jiraKey ?? null,
      input.assigneeId,
      input.assignedBy ?? 'pm',
      now,
      now
    );
    return this.getPMAssignment(id)!;
  }

  getPMAssignment(id: string): PMAssignment | null {
    const stmt = this.db.prepare('SELECT * FROM pm_assignments WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapPMAssignmentRow(row) : null;
  }

  getPMAssignments(filters?: { assigneeId?: string; completed?: boolean }): PMAssignment[] {
    let query = 'SELECT * FROM pm_assignments WHERE 1=1';
    const params: any[] = [];

    if (filters?.assigneeId) {
      query += ' AND assignee_id = ?';
      params.push(filters.assigneeId);
    }
    if (filters?.completed !== undefined) {
      if (filters.completed) {
        query += ' AND completed_at IS NOT NULL';
      } else {
        query += ' AND completed_at IS NULL';
      }
    }

    query += ' ORDER BY assigned_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapPMAssignmentRow);
  }

  getLastAssignmentForMember(memberId: string): PMAssignment | null {
    const stmt = this.db.prepare(`
      SELECT * FROM pm_assignments
      WHERE assignee_id = ?
      ORDER BY assigned_at DESC
      LIMIT 1
    `);
    const row = stmt.get(memberId) as any;
    return row ? this.mapPMAssignmentRow(row) : null;
  }

  getActiveAssignmentsForMember(memberId: string): PMAssignment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pm_assignments
      WHERE assignee_id = ? AND completed_at IS NULL
      ORDER BY assigned_at DESC
    `);
    const rows = stmt.all(memberId) as any[];
    return rows.map(this.mapPMAssignmentRow);
  }

  // Get active Jira tickets assigned to a member
  getActiveJiraTicketsForMember(memberId: string): Ticket[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tickets
      WHERE assignee_id = ?
      AND jira_key IS NOT NULL
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(memberId) as any[];
    return rows.map(this.mapTicketRow);
  }

  // Get unassigned Jira tickets for suggestions
  getUnassignedJiraTickets(): Ticket[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tickets
      WHERE assignee_id IS NULL
      AND jira_key IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const rows = stmt.all() as any[];
    return rows.map(this.mapTicketRow);
  }

  completePMAssignment(id: string): PMAssignment | null {
    const assignment = this.getPMAssignment(id);
    if (!assignment) return null;

    const now = new Date();
    const assignedAt = new Date(assignment.assignedAt);
    const hoursToComplete = (now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60);

    const stmt = this.db.prepare(`
      UPDATE pm_assignments
      SET completed_at = ?, time_to_completion_hours = ?
      WHERE id = ?
    `);
    stmt.run(now.toISOString(), hoursToComplete, id);
    return this.getPMAssignment(id);
  }

  getAvgCompletionTimeForMember(memberId: string): number | null {
    const stmt = this.db.prepare(`
      SELECT AVG(time_to_completion_hours) as avg_hours
      FROM pm_assignments
      WHERE assignee_id = ? AND time_to_completion_hours IS NOT NULL
    `);
    const row = stmt.get(memberId) as any;
    return row?.avg_hours ?? null;
  }

  private mapPMAssignmentRow(row: any): PMAssignment {
    return {
      id: row.id,
      ticketId: row.ticket_id ?? null,
      jiraKey: row.jira_key ?? null,
      assigneeId: row.assignee_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      completedAt: row.completed_at ?? null,
      timeToCompletionHours: row.time_to_completion_hours ?? null,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Engineer Activity Methods
  // ============================================================================

  getEngineerActivity(memberId: string, date?: string): EngineerActivity | null {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT * FROM engineer_activity
      WHERE team_member_id = ? AND activity_date = ?
    `);
    const row = stmt.get(memberId, targetDate) as any;
    return row ? this.mapEngineerActivityRow(row) : null;
  }

  getEngineerActivityRange(memberId: string, startDate: string, endDate: string): EngineerActivity[] {
    const stmt = this.db.prepare(`
      SELECT * FROM engineer_activity
      WHERE team_member_id = ? AND activity_date >= ? AND activity_date <= ?
      ORDER BY activity_date DESC
    `);
    const rows = stmt.all(memberId, startDate, endDate) as any[];
    return rows.map(this.mapEngineerActivityRow);
  }

  getLastActivityForMember(memberId: string): EngineerActivity | null {
    const stmt = this.db.prepare(`
      SELECT * FROM engineer_activity
      WHERE team_member_id = ? AND last_activity_at IS NOT NULL
      ORDER BY activity_date DESC
      LIMIT 1
    `);
    const row = stmt.get(memberId) as any;
    return row ? this.mapEngineerActivityRow(row) : null;
  }

  recordEngineerActivity(memberId: string, updates: { ticketsAssigned?: number; ticketsCompleted?: number }): EngineerActivity {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const id = `${memberId}-${today}`;

    // Try to insert or update
    const existing = this.getEngineerActivity(memberId, today);

    if (existing) {
      const updateFields: string[] = [];
      const params: any[] = [];

      if (updates.ticketsAssigned !== undefined) {
        updateFields.push('tickets_assigned = tickets_assigned + ?');
        params.push(updates.ticketsAssigned);
      }
      if (updates.ticketsCompleted !== undefined) {
        updateFields.push('tickets_completed = tickets_completed + ?');
        params.push(updates.ticketsCompleted);
      }

      updateFields.push('last_activity_at = ?');
      params.push(now);
      params.push(memberId);
      params.push(today);

      const stmt = this.db.prepare(`
        UPDATE engineer_activity SET ${updateFields.join(', ')}
        WHERE team_member_id = ? AND activity_date = ?
      `);
      stmt.run(...params);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO engineer_activity (id, team_member_id, activity_date, tickets_assigned, tickets_completed, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        memberId,
        today,
        updates.ticketsAssigned ?? 0,
        updates.ticketsCompleted ?? 0,
        now
      );
    }

    return this.getEngineerActivity(memberId, today)!;
  }

  private mapEngineerActivityRow(row: any): EngineerActivity {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      activityDate: row.activity_date,
      ticketsAssigned: row.tickets_assigned,
      ticketsCompleted: row.tickets_completed,
      lastActivityAt: row.last_activity_at ?? null,
    };
  }

  // ============================================================================
  // PM Alert Methods
  // ============================================================================

  createPMAlert(input: CreatePMAlertInput): PMAlert {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO pm_alerts (id, team_member_id, alert_type, severity, message, is_dismissed, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    stmt.run(id, input.teamMemberId, input.alertType, input.severity, input.message, now);
    return this.getPMAlert(id)!;
  }

  getPMAlert(id: string): PMAlert | null {
    const stmt = this.db.prepare('SELECT * FROM pm_alerts WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapPMAlertRow(row) : null;
  }

  getActivePMAlerts(): PMAlert[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pm_alerts
      WHERE is_dismissed = 0
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map(this.mapPMAlertRow);
  }

  getPMAlertsForMember(memberId: string): PMAlert[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pm_alerts
      WHERE team_member_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(memberId) as any[];
    return rows.map(this.mapPMAlertRow);
  }

  hasActiveAlertForMember(memberId: string, alertType: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM pm_alerts
      WHERE team_member_id = ? AND alert_type = ? AND is_dismissed = 0
    `);
    const row = stmt.get(memberId, alertType) as { count: number };
    return row.count > 0;
  }

  dismissPMAlert(id: string): void {
    const stmt = this.db.prepare('UPDATE pm_alerts SET is_dismissed = 1 WHERE id = ?');
    stmt.run(id);
  }

  dismissAlertsForMember(memberId: string): void {
    const stmt = this.db.prepare('UPDATE pm_alerts SET is_dismissed = 1 WHERE team_member_id = ?');
    stmt.run(memberId);
  }

  private mapPMAlertRow(row: any): PMAlert {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      alertType: row.alert_type,
      severity: row.severity,
      message: row.message,
      isDismissed: Boolean(row.is_dismissed),
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // AI Ticket Suggestion Methods
  // ============================================================================

  createAISuggestion(input: CreateAISuggestionInput): AITicketSuggestion {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO ai_ticket_suggestions (id, team_member_id, ticket_id, jira_key, title, reasoning, skill_match_score, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    stmt.run(
      id,
      input.teamMemberId,
      input.ticketId ?? null,
      input.jiraKey ?? null,
      input.title,
      input.reasoning,
      input.skillMatchScore,
      now
    );
    return this.getAISuggestion(id)!;
  }

  getAISuggestion(id: string): AITicketSuggestion | null {
    const stmt = this.db.prepare('SELECT * FROM ai_ticket_suggestions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapAISuggestionRow(row) : null;
  }

  getPendingAISuggestions(memberId?: string): AITicketSuggestion[] {
    let query = "SELECT * FROM ai_ticket_suggestions WHERE status = 'pending'";
    const params: any[] = [];

    if (memberId) {
      query += ' AND team_member_id = ?';
      params.push(memberId);
    }

    query += ' ORDER BY skill_match_score DESC, created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapAISuggestionRow);
  }

  getAISuggestionsForMember(memberId: string): AITicketSuggestion[] {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_ticket_suggestions
      WHERE team_member_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(memberId) as any[];
    return rows.map(this.mapAISuggestionRow);
  }

  updateAISuggestionStatus(id: string, status: AISuggestionStatus): AITicketSuggestion | null {
    const stmt = this.db.prepare('UPDATE ai_ticket_suggestions SET status = ? WHERE id = ?');
    stmt.run(status, id);
    return this.getAISuggestion(id);
  }

  clearPendingSuggestionsForMember(memberId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM ai_ticket_suggestions
      WHERE team_member_id = ? AND status = 'pending'
    `);
    stmt.run(memberId);
  }

  private mapAISuggestionRow(row: any): AITicketSuggestion {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      ticketId: row.ticket_id ?? null,
      jiraKey: row.jira_key ?? null,
      title: row.title,
      reasoning: row.reasoning,
      skillMatchScore: row.skill_match_score,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // PM Config Methods
  // ============================================================================

  getPMConfig(): PMConfig {
    const stmt = this.db.prepare("SELECT * FROM pm_config WHERE id = 'singleton'");
    let row = stmt.get() as any;

    // Initialize if not exists
    if (!row) {
      this.db.exec("INSERT INTO pm_config (id) VALUES ('singleton')");
      row = stmt.get() as any;
    }

    return this.mapPMConfigRow(row);
  }

  updatePMConfig(updates: UpdatePMConfigInput): PMConfig {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.underutilizationDays !== undefined) {
      updateFields.push('underutilization_days = ?');
      params.push(updates.underutilizationDays);
    }
    if (updates.inactivityDays !== undefined) {
      updateFields.push('inactivity_days = ?');
      params.push(updates.inactivityDays);
    }
    if (updates.checkIntervalHours !== undefined) {
      updateFields.push('check_interval_hours = ?');
      params.push(updates.checkIntervalHours);
    }

    if (updateFields.length === 0) return this.getPMConfig();

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    const stmt = this.db.prepare(`UPDATE pm_config SET ${updateFields.join(', ')} WHERE id = 'singleton'`);
    stmt.run(...params);
    return this.getPMConfig();
  }

  private mapPMConfigRow(row: any): PMConfig {
    return {
      id: row.id,
      underutilizationDays: row.underutilization_days,
      inactivityDays: row.inactivity_days,
      checkIntervalHours: row.check_interval_hours,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Ideas Session Methods
  // ============================================================================

  createIdeaSession(input: CreateIdeaSessionInput): IdeaSession {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO idea_sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, input.title, now, now);
    return this.getIdeaSession(id)!;
  }

  getIdeaSession(id: string): IdeaSession | null {
    const stmt = this.db.prepare('SELECT * FROM idea_sessions WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapIdeaSessionRow(row) : null;
  }

  getIdeaSessions(filters?: { status?: string }): IdeaSession[] {
    let query = 'SELECT * FROM idea_sessions WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapIdeaSessionRow);
  }

  updateIdeaSession(id: string, input: UpdateIdeaSessionInput): IdeaSession | null {
    const existing = this.getIdeaSession(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.summary !== undefined) {
      updates.push('summary = ?');
      params.push(input.summary);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`UPDATE idea_sessions SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getIdeaSession(id);
  }

  deleteIdeaSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM idea_sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getIdeaSessionFull(id: string): IdeaSessionFull | null {
    const session = this.getIdeaSession(id);
    if (!session) return null;

    return {
      session,
      messages: this.getIdeaMessages(id),
      prd: this.getIdeaPRDBySession(id),
      proposals: this.getIdeaTicketProposals(id),
    };
  }

  private mapIdeaSessionRow(row: any): IdeaSession {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary ?? null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Ideas Message Methods
  // ============================================================================

  createIdeaMessage(input: CreateIdeaMessageInput): IdeaMessage {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO idea_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.sessionId, input.role, input.content, now);

    // Update session updated_at
    this.db.prepare('UPDATE idea_sessions SET updated_at = ? WHERE id = ?')
      .run(now, input.sessionId);

    return this.getIdeaMessage(id)!;
  }

  getIdeaMessage(id: string): IdeaMessage | null {
    const stmt = this.db.prepare('SELECT * FROM idea_messages WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapIdeaMessageRow(row) : null;
  }

  getIdeaMessages(sessionId: string): IdeaMessage[] {
    const stmt = this.db.prepare(
      'SELECT * FROM idea_messages WHERE session_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(sessionId) as any[];
    return rows.map(this.mapIdeaMessageRow);
  }

  private mapIdeaMessageRow(row: any): IdeaMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Ideas PRD Methods
  // ============================================================================

  createIdeaPRD(input: CreateIdeaPRDInput): IdeaPRD {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO idea_prds (
        id, session_id, title, problem_statement, goals, user_stories,
        functional_requirements, non_functional_requirements, success_metrics,
        scope_boundaries, technical_considerations, raw_content, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      input.sessionId,
      input.title,
      input.problemStatement,
      JSON.stringify(input.goals),
      JSON.stringify(input.userStories),
      JSON.stringify(input.functionalRequirements),
      input.nonFunctionalRequirements,
      input.successMetrics,
      JSON.stringify(input.scopeBoundaries),
      input.technicalConsiderations ?? null,
      input.rawContent,
      now,
      now
    );

    // Update session status
    this.updateIdeaSession(input.sessionId, { status: 'prd_generated' });

    return this.getIdeaPRD(id)!;
  }

  getIdeaPRD(id: string): IdeaPRD | null {
    const stmt = this.db.prepare('SELECT * FROM idea_prds WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapIdeaPRDRow(row) : null;
  }

  getIdeaPRDBySession(sessionId: string): IdeaPRD | null {
    const stmt = this.db.prepare('SELECT * FROM idea_prds WHERE session_id = ?');
    const row = stmt.get(sessionId) as any;
    return row ? this.mapIdeaPRDRow(row) : null;
  }

  updateIdeaPRD(id: string, input: UpdateIdeaPRDInput): IdeaPRD | null {
    const existing = this.getIdeaPRD(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.problemStatement !== undefined) {
      updates.push('problem_statement = ?');
      params.push(input.problemStatement);
    }
    if (input.goals !== undefined) {
      updates.push('goals = ?');
      params.push(JSON.stringify(input.goals));
    }
    if (input.userStories !== undefined) {
      updates.push('user_stories = ?');
      params.push(JSON.stringify(input.userStories));
    }
    if (input.functionalRequirements !== undefined) {
      updates.push('functional_requirements = ?');
      params.push(JSON.stringify(input.functionalRequirements));
    }
    if (input.nonFunctionalRequirements !== undefined) {
      updates.push('non_functional_requirements = ?');
      params.push(input.nonFunctionalRequirements);
    }
    if (input.successMetrics !== undefined) {
      updates.push('success_metrics = ?');
      params.push(input.successMetrics);
    }
    if (input.scopeBoundaries !== undefined) {
      updates.push('scope_boundaries = ?');
      params.push(JSON.stringify(input.scopeBoundaries));
    }
    if (input.technicalConsiderations !== undefined) {
      updates.push('technical_considerations = ?');
      params.push(input.technicalConsiderations);
    }
    if (input.rawContent !== undefined) {
      updates.push('raw_content = ?');
      params.push(input.rawContent);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const stmt = this.db.prepare(`UPDATE idea_prds SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getIdeaPRD(id);
  }

  private mapIdeaPRDRow(row: any): IdeaPRD {
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      problemStatement: row.problem_statement,
      goals: JSON.parse(row.goals || '[]'),
      userStories: JSON.parse(row.user_stories || '[]'),
      functionalRequirements: JSON.parse(row.functional_requirements || '[]'),
      nonFunctionalRequirements: row.non_functional_requirements,
      successMetrics: row.success_metrics,
      scopeBoundaries: JSON.parse(row.scope_boundaries || '{"inScope":[],"outOfScope":[]}'),
      technicalConsiderations: row.technical_considerations ?? null,
      rawContent: row.raw_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Ideas Ticket Proposal Methods
  // ============================================================================

  createIdeaTicketProposal(input: CreateTicketProposalInput): IdeaTicketProposal {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO idea_ticket_proposals (
        id, session_id, prd_id, title, description, acceptance_criteria,
        ticket_type, priority, layer, required_skills, suggested_assignee_id,
        suggested_epic_id, assignment_confidence, assignment_reasoning,
        feature_group_id, affected_files, implementation_hints, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      input.sessionId,
      input.prdId,
      input.title,
      input.description,
      JSON.stringify(input.acceptanceCriteria),
      input.ticketType,
      input.priority,
      input.layer,
      JSON.stringify(input.requiredSkills ?? []),
      input.suggestedAssigneeId ?? null,
      input.suggestedEpicId ?? null,
      input.assignmentConfidence ?? 0,
      input.assignmentReasoning ?? null,
      input.featureGroupId ?? null,
      JSON.stringify(input.affectedFiles ?? []),
      input.implementationHints ?? null,
      now
    );
    return this.getIdeaTicketProposal(id)!;
  }

  createIdeaTicketProposals(inputs: CreateTicketProposalInput[]): IdeaTicketProposal[] {
    const createMany = this.db.transaction((proposalList: CreateTicketProposalInput[]) => {
      return proposalList.map((input) => this.createIdeaTicketProposal(input));
    });
    return createMany(inputs);
  }

  getIdeaTicketProposal(id: string): IdeaTicketProposal | null {
    const stmt = this.db.prepare('SELECT * FROM idea_ticket_proposals WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapIdeaTicketProposalRow(row) : null;
  }

  getIdeaTicketProposals(sessionId: string, status?: TicketProposalStatus): IdeaTicketProposal[] {
    let query = 'SELECT * FROM idea_ticket_proposals WHERE session_id = ?';
    const params: any[] = [sessionId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapIdeaTicketProposalRow);
  }

  updateIdeaTicketProposal(id: string, input: UpdateTicketProposalInput): IdeaTicketProposal | null {
    const existing = this.getIdeaTicketProposal(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }
    if (input.acceptanceCriteria !== undefined) {
      updates.push('acceptance_criteria = ?');
      params.push(JSON.stringify(input.acceptanceCriteria));
    }
    if (input.ticketType !== undefined) {
      updates.push('ticket_type = ?');
      params.push(input.ticketType);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      params.push(input.priority);
    }
    if (input.layer !== undefined) {
      updates.push('layer = ?');
      params.push(input.layer);
    }
    if (input.requiredSkills !== undefined) {
      updates.push('required_skills = ?');
      params.push(JSON.stringify(input.requiredSkills));
    }
    if (input.suggestedAssigneeId !== undefined) {
      updates.push('suggested_assignee_id = ?');
      params.push(input.suggestedAssigneeId);
    }
    if (input.suggestedEpicId !== undefined) {
      updates.push('suggested_epic_id = ?');
      params.push(input.suggestedEpicId);
    }
    if (input.assignmentConfidence !== undefined) {
      updates.push('assignment_confidence = ?');
      params.push(input.assignmentConfidence);
    }
    if (input.assignmentReasoning !== undefined) {
      updates.push('assignment_reasoning = ?');
      params.push(input.assignmentReasoning);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.createdTicketId !== undefined) {
      updates.push('created_ticket_id = ?');
      params.push(input.createdTicketId);
    }
    if (input.affectedFiles !== undefined) {
      updates.push('affected_files = ?');
      params.push(JSON.stringify(input.affectedFiles));
    }
    if (input.implementationHints !== undefined) {
      updates.push('implementation_hints = ?');
      params.push(input.implementationHints);
    }

    if (updates.length === 0) return existing;

    params.push(id);

    const stmt = this.db.prepare(`UPDATE idea_ticket_proposals SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return this.getIdeaTicketProposal(id);
  }

  approveIdeaTicketProposal(id: string, createdTicketId: string): IdeaTicketProposal | null {
    return this.updateIdeaTicketProposal(id, {
      status: 'created',
      createdTicketId,
    });
  }

  rejectIdeaTicketProposal(id: string): IdeaTicketProposal | null {
    return this.updateIdeaTicketProposal(id, { status: 'rejected' });
  }

  private mapIdeaTicketProposalRow(row: any): IdeaTicketProposal {
    return {
      id: row.id,
      sessionId: row.session_id,
      prdId: row.prd_id,
      title: row.title,
      description: row.description,
      acceptanceCriteria: JSON.parse(row.acceptance_criteria || '[]'),
      ticketType: row.ticket_type,
      priority: row.priority,
      layer: row.layer,
      requiredSkills: JSON.parse(row.required_skills || '[]'),
      suggestedAssigneeId: row.suggested_assignee_id ?? null,
      suggestedEpicId: row.suggested_epic_id ?? null,
      assignmentConfidence: row.assignment_confidence ?? 0,
      assignmentReasoning: row.assignment_reasoning ?? null,
      status: row.status,
      createdTicketId: row.created_ticket_id ?? null,
      featureGroupId: row.feature_group_id ?? null,
      affectedFiles: JSON.parse(row.affected_files || '[]'),
      implementationHints: row.implementation_hints ?? undefined,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Codebase Context Methods
  // ============================================================================

  createCodebaseContext(input: {
    name: string;
    rootPath: string;
    analyzedAt: string;
    totalFiles: number;
    totalDirectories: number;
    languageBreakdown: Record<string, number>;
    contextSummary: string;
    rawAnalysis: string;
  }): CodebaseContext {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO codebase_contexts (id, name, root_path, analyzed_at, total_files, total_directories, language_breakdown, context_summary, raw_analysis, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.rootPath, input.analyzedAt, input.totalFiles, input.totalDirectories, JSON.stringify(input.languageBreakdown), input.contextSummary, input.rawAnalysis, now, now);
    return this.getCodebaseContext(id)!;
  }

  getCodebaseContext(id: string): CodebaseContext | null {
    const stmt = this.db.prepare('SELECT * FROM codebase_contexts WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      analyzedAt: row.analyzed_at,
      totalFiles: row.total_files,
      contextSummary: row.context_summary,
      rawAnalysis: row.raw_analysis,
      createdAt: row.created_at,
    };
  }

  getCodebaseContexts(): CodebaseContextListItem[] {
    const stmt = this.db.prepare('SELECT id, name, root_path, analyzed_at, total_files, language_breakdown, created_at FROM codebase_contexts ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      analyzedAt: row.analyzed_at,
      totalFiles: row.total_files,
      languageBreakdown: JSON.parse(row.language_breakdown || '{}'),
      createdAt: row.created_at,
    }));
  }

  deleteCodebaseContext(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM codebase_contexts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ============================================================================
  // Project Context Methods
  // ============================================================================

  getProjectContext(): ProjectContext | null {
    // Ensure default row exists
    const existsCheck = this.db.prepare("SELECT COUNT(*) as count FROM project_context WHERE id = 'default'").get() as { count: number };
    if (existsCheck.count === 0) {
      this.db.exec("INSERT INTO project_context (id) VALUES ('default')");
    }

    const stmt = this.db.prepare("SELECT * FROM project_context WHERE id = 'default'");
    const row = stmt.get() as any;
    return row ? this.mapProjectContextRow(row) : null;
  }

  updateProjectContext(input: ProjectContextInput): ProjectContext {
    const now = new Date().toISOString();

    // Ensure default row exists
    const existsCheck = this.db.prepare("SELECT COUNT(*) as count FROM project_context WHERE id = 'default'").get() as { count: number };
    if (existsCheck.count === 0) {
      this.db.exec("INSERT INTO project_context (id) VALUES ('default')");
    }

    const stmt = this.db.prepare(`
      UPDATE project_context
      SET project_name = ?, description = ?, tech_stack = ?, architecture = ?,
          product_areas = ?, conventions = ?, additional_context = ?, updated_at = ?
      WHERE id = 'default'
    `);
    stmt.run(
      input.projectName,
      input.description,
      input.techStack,
      input.architecture,
      input.productAreas,
      input.conventions,
      input.additionalContext,
      now
    );
    return this.getProjectContext()!;
  }

  private mapProjectContextRow(row: any): ProjectContext {
    return {
      id: row.id,
      projectName: row.project_name ?? '',
      description: row.description ?? '',
      techStack: row.tech_stack ?? '',
      architecture: row.architecture ?? '',
      productAreas: row.product_areas ?? '',
      conventions: row.conventions ?? '',
      additionalContext: row.additional_context ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Bitbucket Integration Methods
  // ============================================================================

  // Bitbucket Config Methods
  getBitbucketConfig(): BitbucketConfig | null {
    const stmt = this.db.prepare("SELECT * FROM bitbucket_config WHERE id = 'default'");
    const row = stmt.get() as any;
    return row ? this.mapBitbucketConfigRow(row) : null;
  }

  saveBitbucketConfig(input: CreateBitbucketConfigInput): BitbucketConfig {
    const now = new Date().toISOString();
    const existing = this.getBitbucketConfig();

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE bitbucket_config
        SET workspace = ?, username = ?, app_password = ?, sync_interval = ?, auto_discover_repos = ?, updated_at = ?
        WHERE id = 'default'
      `);
      stmt.run(
        input.workspace,
        input.email, // DB column is 'username' but stores email for API token auth
        input.appPassword,
        input.syncInterval ?? 300,
        input.autoDiscoverRepos !== false ? 1 : 0,
        now
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO bitbucket_config (id, workspace, username, app_password, sync_interval, auto_discover_repos, created_at, updated_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        input.workspace,
        input.email, // DB column is 'username' but stores email for API token auth
        input.appPassword,
        input.syncInterval ?? 300,
        input.autoDiscoverRepos !== false ? 1 : 0,
        now,
        now
      );
    }
    return this.getBitbucketConfig()!;
  }

  updateBitbucketConfig(input: UpdateBitbucketConfigInput): BitbucketConfig | null {
    const existing = this.getBitbucketConfig();
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [];

    if (input.workspace !== undefined) {
      updates.push('workspace = ?');
      params.push(input.workspace);
    }
    if (input.email !== undefined) {
      updates.push('username = ?'); // DB column is 'username' but stores email
      params.push(input.email);
    }
    if (input.appPassword !== undefined) {
      updates.push('app_password = ?');
      params.push(input.appPassword);
    }
    if (input.syncInterval !== undefined) {
      updates.push('sync_interval = ?');
      params.push(input.syncInterval);
    }
    if (input.autoDiscoverRepos !== undefined) {
      updates.push('auto_discover_repos = ?');
      params.push(input.autoDiscoverRepos ? 1 : 0);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    const stmt = this.db.prepare(`UPDATE bitbucket_config SET ${updates.join(', ')} WHERE id = 'default'`);
    stmt.run(...params);
    return this.getBitbucketConfig();
  }

  private mapBitbucketConfigRow(row: any): BitbucketConfig {
    return {
      id: row.id,
      workspace: row.workspace,
      email: row.username, // DB column is 'username' but stores email for API token auth
      appPassword: row.app_password,
      syncInterval: row.sync_interval,
      autoDiscoverRepos: Boolean(row.auto_discover_repos),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Bitbucket Repo Methods
  getBitbucketRepos(activeOnly = false): BitbucketRepo[] {
    let query = 'SELECT * FROM bitbucket_repos';
    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name';
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    return rows.map(this.mapBitbucketRepoRow);
  }

  getBitbucketRepo(slug: string): BitbucketRepo | null {
    const stmt = this.db.prepare('SELECT * FROM bitbucket_repos WHERE slug = ?');
    const row = stmt.get(slug) as any;
    return row ? this.mapBitbucketRepoRow(row) : null;
  }

  upsertBitbucketRepo(repo: { slug: string; name: string; workspace: string; discoveredVia?: 'auto' | 'manual' }): BitbucketRepo {
    const existing = this.getBitbucketRepo(repo.slug);
    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE bitbucket_repos SET name = ?, workspace = ? WHERE slug = ?
      `);
      stmt.run(repo.name, repo.workspace, repo.slug);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO bitbucket_repos (slug, name, workspace, discovered_via)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(repo.slug, repo.name, repo.workspace, repo.discoveredVia ?? 'auto');
    }
    return this.getBitbucketRepo(repo.slug)!;
  }

  updateBitbucketRepoActive(slug: string, isActive: boolean): BitbucketRepo | null {
    const stmt = this.db.prepare('UPDATE bitbucket_repos SET is_active = ? WHERE slug = ?');
    stmt.run(isActive ? 1 : 0, slug);
    return this.getBitbucketRepo(slug);
  }

  updateBitbucketRepoSyncTime(slug: string): void {
    const stmt = this.db.prepare('UPDATE bitbucket_repos SET last_synced_at = ? WHERE slug = ?');
    stmt.run(new Date().toISOString(), slug);
  }

  private mapBitbucketRepoRow(row: any): BitbucketRepo {
    return {
      slug: row.slug,
      name: row.name,
      workspace: row.workspace,
      isActive: Boolean(row.is_active),
      lastSyncedAt: row.last_synced_at ?? null,
      discoveredVia: row.discovered_via,
    };
  }

  // Bitbucket Pull Request Methods
  getBitbucketPullRequests(options: {
    repoSlug?: string;
    state?: 'OPEN' | 'MERGED' | 'DECLINED';
    authorUsername?: string;
    teamMemberId?: string;
    limit?: number;
  } = {}): BitbucketPullRequest[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.repoSlug) {
      conditions.push('repo_slug = ?');
      params.push(options.repoSlug);
    }
    if (options.state) {
      conditions.push('state = ?');
      params.push(options.state);
    }
    if (options.authorUsername) {
      conditions.push('author_username = ?');
      params.push(options.authorUsername);
    }
    if (options.teamMemberId) {
      conditions.push('team_member_id = ?');
      params.push(options.teamMemberId);
    }

    let query = 'SELECT * FROM bitbucket_pull_requests';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY updated_at DESC';
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapBitbucketPRRow);
  }

  getBitbucketPullRequest(repoSlug: string, prNumber: number): BitbucketPullRequest | null {
    const stmt = this.db.prepare('SELECT * FROM bitbucket_pull_requests WHERE repo_slug = ? AND pr_number = ?');
    const row = stmt.get(repoSlug, prNumber) as any;
    return row ? this.mapBitbucketPRRow(row) : null;
  }

  upsertBitbucketPullRequest(pr: BitbucketPullRequest): BitbucketPullRequest {
    const existing = this.getBitbucketPullRequest(pr.repoSlug, pr.prNumber);
    const reviewersJson = JSON.stringify(pr.reviewers);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE bitbucket_pull_requests
        SET title = ?, description = ?, author_username = ?, author_display_name = ?,
            state = ?, source_branch = ?, destination_branch = ?, reviewers = ?,
            jira_key = ?, updated_at = ?, merged_at = ?, team_member_id = ?
        WHERE repo_slug = ? AND pr_number = ?
      `);
      stmt.run(
        pr.title, pr.description, pr.authorUsername, pr.authorDisplayName,
        pr.state, pr.sourceBranch, pr.destinationBranch, reviewersJson,
        pr.jiraKey, pr.updatedAt, pr.mergedAt, pr.teamMemberId,
        pr.repoSlug, pr.prNumber
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO bitbucket_pull_requests
        (id, repo_slug, pr_number, title, description, author_username, author_display_name,
         state, source_branch, destination_branch, reviewers, jira_key, created_at, updated_at, merged_at, team_member_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        pr.id, pr.repoSlug, pr.prNumber, pr.title, pr.description,
        pr.authorUsername, pr.authorDisplayName, pr.state, pr.sourceBranch,
        pr.destinationBranch, reviewersJson, pr.jiraKey, pr.createdAt,
        pr.updatedAt, pr.mergedAt, pr.teamMemberId
      );
    }
    return this.getBitbucketPullRequest(pr.repoSlug, pr.prNumber)!;
  }

  private mapBitbucketPRRow(row: any): BitbucketPullRequest {
    return {
      id: row.id,
      repoSlug: row.repo_slug,
      prNumber: row.pr_number,
      title: row.title,
      description: row.description,
      authorUsername: row.author_username,
      authorDisplayName: row.author_display_name,
      state: row.state,
      sourceBranch: row.source_branch,
      destinationBranch: row.destination_branch,
      reviewers: JSON.parse(row.reviewers || '[]'),
      jiraKey: row.jira_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mergedAt: row.merged_at,
      teamMemberId: row.team_member_id,
    };
  }

  // Bitbucket Commit Methods
  getBitbucketCommits(options: {
    repoSlug?: string;
    authorUsername?: string;
    teamMemberId?: string;
    since?: string;
    limit?: number;
  } = {}): BitbucketCommit[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.repoSlug) {
      conditions.push('repo_slug = ?');
      params.push(options.repoSlug);
    }
    if (options.authorUsername) {
      conditions.push('author_username = ?');
      params.push(options.authorUsername);
    }
    if (options.teamMemberId) {
      conditions.push('team_member_id = ?');
      params.push(options.teamMemberId);
    }
    if (options.since) {
      conditions.push('committed_at >= ?');
      params.push(options.since);
    }

    let query = 'SELECT * FROM bitbucket_commits';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY committed_at DESC';
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapBitbucketCommitRow);
  }

  getBitbucketCommit(hash: string): BitbucketCommit | null {
    const stmt = this.db.prepare('SELECT * FROM bitbucket_commits WHERE hash = ?');
    const row = stmt.get(hash) as any;
    return row ? this.mapBitbucketCommitRow(row) : null;
  }

  upsertBitbucketCommit(commit: BitbucketCommit): BitbucketCommit {
    const existing = this.getBitbucketCommit(commit.hash);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE bitbucket_commits
        SET team_member_id = ?
        WHERE hash = ?
      `);
      stmt.run(commit.teamMemberId, commit.hash);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO bitbucket_commits
        (hash, repo_slug, author_username, author_display_name, message, jira_key, committed_at, team_member_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        commit.hash, commit.repoSlug, commit.authorUsername, commit.authorDisplayName,
        commit.message, commit.jiraKey, commit.committedAt, commit.teamMemberId
      );
    }
    return this.getBitbucketCommit(commit.hash)!;
  }

  private mapBitbucketCommitRow(row: any): BitbucketCommit {
    return {
      hash: row.hash,
      repoSlug: row.repo_slug,
      authorUsername: row.author_username,
      authorDisplayName: row.author_display_name,
      message: row.message,
      jiraKey: row.jira_key,
      committedAt: row.committed_at,
      teamMemberId: row.team_member_id,
    };
  }

  // Bitbucket Pipeline Methods
  getBitbucketPipelines(options: {
    repoSlug?: string;
    state?: string;
    since?: string;
    limit?: number;
  } = {}): BitbucketPipeline[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.repoSlug) {
      conditions.push('repo_slug = ?');
      params.push(options.repoSlug);
    }
    if (options.state) {
      conditions.push('state = ?');
      params.push(options.state);
    }
    if (options.since) {
      conditions.push('created_at >= ?');
      params.push(options.since);
    }

    let query = 'SELECT * FROM bitbucket_pipelines';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC';
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapBitbucketPipelineRow);
  }

  getBitbucketPipeline(uuid: string): BitbucketPipeline | null {
    const stmt = this.db.prepare('SELECT * FROM bitbucket_pipelines WHERE uuid = ?');
    const row = stmt.get(uuid) as any;
    return row ? this.mapBitbucketPipelineRow(row) : null;
  }

  upsertBitbucketPipeline(pipeline: BitbucketPipeline): BitbucketPipeline {
    const existing = this.getBitbucketPipeline(pipeline.uuid);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE bitbucket_pipelines
        SET state = ?, result = ?, duration_seconds = ?, completed_at = ?
        WHERE uuid = ?
      `);
      stmt.run(pipeline.state, pipeline.result, pipeline.durationSeconds, pipeline.completedAt, pipeline.uuid);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO bitbucket_pipelines
        (uuid, repo_slug, build_number, state, result, trigger_type, branch, commit_hash, duration_seconds, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        pipeline.uuid, pipeline.repoSlug, pipeline.buildNumber, pipeline.state,
        pipeline.result, pipeline.triggerType, pipeline.branch, pipeline.commitHash,
        pipeline.durationSeconds, pipeline.createdAt, pipeline.completedAt
      );
    }
    return this.getBitbucketPipeline(pipeline.uuid)!;
  }

  private mapBitbucketPipelineRow(row: any): BitbucketPipeline {
    return {
      uuid: row.uuid,
      repoSlug: row.repo_slug,
      buildNumber: row.build_number,
      state: row.state,
      result: row.result,
      triggerType: row.trigger_type,
      branch: row.branch,
      commitHash: row.commit_hash,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  // Bitbucket XP Award Methods
  getBitbucketXPAwards(options: { teamMemberId?: string; source?: string; limit?: number } = {}): BitbucketXPAward[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.teamMemberId) {
      conditions.push('team_member_id = ?');
      params.push(options.teamMemberId);
    }
    if (options.source) {
      conditions.push('source = ?');
      params.push(options.source);
    }

    let query = 'SELECT * FROM bitbucket_xp_awards';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY awarded_at DESC';
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(this.mapBitbucketXPAwardRow);
  }

  getBitbucketXPAward(source: string, referenceId: string): BitbucketXPAward | null {
    const stmt = this.db.prepare('SELECT * FROM bitbucket_xp_awards WHERE source = ? AND reference_id = ?');
    const row = stmt.get(source, referenceId) as any;
    return row ? this.mapBitbucketXPAwardRow(row) : null;
  }

  createBitbucketXPAward(award: Omit<BitbucketXPAward, 'id' | 'awardedAt'>): BitbucketXPAward | null {
    // Check if already awarded (prevent duplicates)
    const existing = this.getBitbucketXPAward(award.source, award.referenceId);
    if (existing) return null;

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO bitbucket_xp_awards (id, team_member_id, xp_amount, source, reference_id, repo_slug, awarded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, award.teamMemberId, award.xpAmount, award.source, award.referenceId, award.repoSlug, now);

    // Also add XP to member_progress (integrates with existing gamification)
    this.addMemberXP(award.teamMemberId, award.xpAmount);

    return this.getBitbucketXPAward(award.source, award.referenceId);
  }

  getTotalBitbucketXP(teamMemberId: string): number {
    const stmt = this.db.prepare('SELECT SUM(xp_amount) as total FROM bitbucket_xp_awards WHERE team_member_id = ?');
    const row = stmt.get(teamMemberId) as { total: number | null };
    return row?.total ?? 0;
  }

  private mapBitbucketXPAwardRow(row: any): BitbucketXPAward {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      xpAmount: row.xp_amount,
      source: row.source,
      referenceId: row.reference_id,
      repoSlug: row.repo_slug,
      awardedAt: row.awarded_at,
    };
  }

  // Bitbucket Sync State Methods
  getBitbucketSyncState(): BitbucketSyncState {
    const stmt = this.db.prepare("SELECT * FROM bitbucket_sync_state WHERE id = 'singleton'");
    const row = stmt.get() as any;
    return this.mapBitbucketSyncStateRow(row);
  }

  updateBitbucketSyncState(updates: UpdateBitbucketSyncConfigInput & {
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    errorCount?: number;
    lastError?: string | null;
  }): BitbucketSyncState {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.syncIntervalMs !== undefined) {
      updateFields.push('sync_interval_ms = ?');
      params.push(updates.syncIntervalMs);
    }
    if (updates.syncEnabled !== undefined) {
      updateFields.push('sync_enabled = ?');
      params.push(updates.syncEnabled ? 1 : 0);
    }
    if (updates.lastSyncAt !== undefined) {
      updateFields.push('last_sync_at = ?');
      params.push(updates.lastSyncAt);
    }
    if (updates.lastSuccessfulSyncAt !== undefined) {
      updateFields.push('last_successful_sync_at = ?');
      params.push(updates.lastSuccessfulSyncAt);
    }
    if (updates.errorCount !== undefined) {
      updateFields.push('error_count = ?');
      params.push(updates.errorCount);
    }
    if (updates.lastError !== undefined) {
      updateFields.push('last_error = ?');
      params.push(updates.lastError);
    }

    if (updateFields.length === 0) return this.getBitbucketSyncState();

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    const stmt = this.db.prepare(`UPDATE bitbucket_sync_state SET ${updateFields.join(', ')} WHERE id = 'singleton'`);
    stmt.run(...params);
    return this.getBitbucketSyncState();
  }

  private mapBitbucketSyncStateRow(row: any): BitbucketSyncState {
    return {
      id: row.id,
      lastSyncAt: row.last_sync_at ?? null,
      lastSuccessfulSyncAt: row.last_successful_sync_at ?? null,
      syncIntervalMs: row.sync_interval_ms,
      syncEnabled: Boolean(row.sync_enabled),
      errorCount: row.error_count,
      lastError: row.last_error ?? null,
      updatedAt: row.updated_at,
    };
  }

  // Helper: Get team member by Bitbucket username
  getTeamMemberByBitbucketUsername(username: string): TeamMember | null {
    const stmt = this.db.prepare('SELECT * FROM team_members WHERE LOWER(bitbucket_username) = LOWER(?)');
    const row = stmt.get(username) as any;
    return row ? this.mapTeamMemberRow(row) : null;
  }

  // Helper: Get Bitbucket metrics for all team members
  getBitbucketEngineerMetrics(): Array<{
    teamMemberId: string;
    memberName: string;
    bitbucketUsername: string | null;
    prsOpened: number;
    prsMerged: number;
    prsReviewed: number;
    commits: number;
    totalXP: number;
  }> {
    const teamMembers = this.getTeamMembers();
    const metrics: Array<{
      teamMemberId: string;
      memberName: string;
      bitbucketUsername: string | null;
      prsOpened: number;
      prsMerged: number;
      prsReviewed: number;
      commits: number;
      totalXP: number;
    }> = [];

    for (const member of teamMembers) {
      // Count PRs opened (as author)
      const prsOpenedStmt = this.db.prepare('SELECT COUNT(*) as count FROM bitbucket_pull_requests WHERE team_member_id = ?');
      const prsOpened = (prsOpenedStmt.get(member.id) as { count: number }).count;

      // Count PRs merged
      const prsMergedStmt = this.db.prepare("SELECT COUNT(*) as count FROM bitbucket_pull_requests WHERE team_member_id = ? AND state = 'MERGED'");
      const prsMerged = (prsMergedStmt.get(member.id) as { count: number }).count;

      // Count reviews (from XP awards)
      const reviewsStmt = this.db.prepare("SELECT COUNT(*) as count FROM bitbucket_xp_awards WHERE team_member_id = ? AND source IN ('pr_reviewed', 'pr_reviewed_changes')");
      const prsReviewed = (reviewsStmt.get(member.id) as { count: number }).count;

      // Count commits
      const commitsStmt = this.db.prepare('SELECT COUNT(*) as count FROM bitbucket_commits WHERE team_member_id = ?');
      const commits = (commitsStmt.get(member.id) as { count: number }).count;

      // Get total XP
      const totalXP = this.getTotalBitbucketXP(member.id);

      metrics.push({
        teamMemberId: member.id,
        memberName: member.name,
        bitbucketUsername: member.bitbucketUsername ?? null,
        prsOpened,
        prsMerged,
        prsReviewed,
        commits,
        totalXP,
      });
    }

    return metrics.sort((a, b) => b.totalXP - a.totalXP);
  }

  // ============================================================================
  // Meetings
  // ============================================================================

  createMeeting(input: {
    id: string;
    title: string;
    meetingType: string;
    rawInput: string;
    aiSummary?: string;
  }): any {
    this.db.prepare(
      'INSERT INTO meetings (id, title, meeting_type, raw_input, ai_summary) VALUES (?, ?, ?, ?, ?)'
    ).run(input.id, input.title, input.meetingType, input.rawInput, input.aiSummary ?? null);
    return this.getMeeting(input.id)!;
  }

  getMeetings(filters?: { limit?: number; meetingType?: string }): any[] {
    let query = 'SELECT * FROM meetings WHERE 1=1';
    const params: any[] = [];
    if (filters?.meetingType) { query += ' AND meeting_type = ?'; params.push(filters.meetingType); }
    query += ' ORDER BY created_at DESC';
    if (filters?.limit) { query += ' LIMIT ?'; params.push(filters.limit); }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.mapMeetingRow(row));
  }

  getMeeting(id: string): any | null {
    const row = this.db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as any;
    return row ? this.mapMeetingRow(row) : null;
  }

  getMeetingActionItem(id: string): any | null {
    const row = this.db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      meetingId: row.meeting_id,
      text: row.action,
      assignee: row.assignee_id,
      dueDate: row.due_date,
      status: row.status === 'open' ? 'pending' : row.status,
      ticketId: row.jira_ticket_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  updateMeetingActionItem(id: string, input: { status?: string; assignee?: string; assigneeId?: string; dueDate?: string; ticketId?: string; jiraTicketId?: string }): any | null {
    const updates: string[] = [];
    const params: any[] = [];
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status === 'pending' ? 'open' : input.status);
    }
    const assignee = input.assignee ?? input.assigneeId;
    if (assignee !== undefined) { updates.push('assignee_id = ?'); params.push(assignee); }
    if (input.dueDate !== undefined) { updates.push('due_date = ?'); params.push(input.dueDate); }
    const ticketId = input.ticketId ?? input.jiraTicketId;
    if (ticketId !== undefined) { updates.push('jira_ticket_id = ?'); params.push(ticketId); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE meeting_action_items SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
    }
    return this.getMeetingActionItem(id);
  }

  private mapMeetingRow(row: any): { id: string; title: string; meetingType: string; rawInput: string; aiSummary: string | null; createdAt: string; updatedAt: string } {
    return {
      id: row.id,
      title: row.title,
      meetingType: row.meeting_type,
      rawInput: row.raw_input,
      aiSummary: row.ai_summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Stale Ticket Detections
  // ============================================================================

  createStaleDetection(input: {
    jiraKey: string;
    detectionType: string;
    severity: string;
    evidence: string;
    teamMemberId?: string;
  }): { id: string; jiraKey: string; detectionType: string; severity: string; evidence: string; status: string; teamMemberId: string | null; createdAt: string; resolvedAt: string | null } {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO stale_ticket_detections (id, jira_key, detection_type, severity, evidence, team_member_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, input.jiraKey, input.detectionType, input.severity, input.evidence, input.teamMemberId ?? null);
    return this.db.prepare('SELECT * FROM stale_ticket_detections WHERE id = ?').get(id) as any;
  }

  getStaleDetections(filters?: { jiraKey?: string; detectionType?: string; status?: string }): any[] {
    let query = 'SELECT * FROM stale_ticket_detections WHERE 1=1';
    const params: any[] = [];
    if (filters?.jiraKey) { query += ' AND jira_key = ?'; params.push(filters.jiraKey); }
    if (filters?.detectionType) { query += ' AND detection_type = ?'; params.push(filters.detectionType); }
    if (filters?.status) { query += ' AND status = ?'; params.push(filters.status); }
    query += ' ORDER BY created_at DESC';
    return this.db.prepare(query).all(...params) as any[];
  }

  updateStaleDetectionStatus(id: string, status: string): void {
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    this.db.prepare('UPDATE stale_ticket_detections SET status = ?, resolved_at = ? WHERE id = ?').run(status, resolvedAt, id);
  }

  // ============================================================================
  // Ticket Status History
  // ============================================================================

  recordStatusTransition(input: { jiraKey: string; oldStatus: string | null; newStatus: string }): void {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO ticket_status_history (id, jira_key, old_status, new_status) VALUES (?, ?, ?, ?)'
    ).run(id, input.jiraKey, input.oldStatus, input.newStatus);
  }

  getStatusHistory(jiraKey: string): { id: string; jiraKey: string; oldStatus: string | null; newStatus: string; changedAt: string }[] {
    const rows = this.db.prepare('SELECT * FROM ticket_status_history WHERE jira_key = ? ORDER BY changed_at DESC').all(jiraKey) as any[];
    return rows.map(r => ({
      id: r.id,
      jiraKey: r.jira_key,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      changedAt: r.changed_at,
    }));
  }

  // ============================================================================
  // Accountability Flags
  // ============================================================================

  createAccountabilityFlag(input: {
    teamMemberId: string;
    flagType: string;
    severity: string;
    message: string;
    metadata?: string;
  }): { id: string; teamMemberId: string; flagType: string; severity: string; message: string; metadata: string | null; status: string; createdAt: string; resolvedAt: string | null } {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO accountability_flags (id, team_member_id, flag_type, severity, message, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, input.teamMemberId, input.flagType, input.severity, input.message, input.metadata ?? null);
    return this.db.prepare('SELECT * FROM accountability_flags WHERE id = ?').get(id) as any;
  }

  getAccountabilityFlags(filters?: { teamMemberId?: string; flagType?: string; status?: string }): any[] {
    let query = 'SELECT * FROM accountability_flags WHERE 1=1';
    const params: any[] = [];
    if (filters?.teamMemberId) { query += ' AND team_member_id = ?'; params.push(filters.teamMemberId); }
    if (filters?.flagType) { query += ' AND flag_type = ?'; params.push(filters.flagType); }
    if (filters?.status) { query += ' AND status = ?'; params.push(filters.status); }
    query += ' ORDER BY created_at DESC';
    return this.db.prepare(query).all(...params) as any[];
  }

  updateAccountabilityFlagStatus(id: string, status: string): void {
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    this.db.prepare('UPDATE accountability_flags SET status = ?, resolved_at = ? WHERE id = ?').run(status, resolvedAt, id);
  }

  // ============================================================================
  // Engineer Patterns
  // ============================================================================

  upsertEngineerPattern(input: {
    teamMemberId: string;
    weekStart: string;
    ticketsCompleted?: number;
    ticketsStarted?: number;
    commitsCount?: number;
    prsMerged?: number;
    avgCycleTimeHours?: number;
    aiAnalysis?: string;
  }): void {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO engineer_patterns (id, team_member_id, week_start, tickets_completed, tickets_started, commits_count, prs_merged, avg_cycle_time_hours, ai_analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(team_member_id, week_start) DO UPDATE SET
        tickets_completed = excluded.tickets_completed,
        tickets_started = excluded.tickets_started,
        commits_count = excluded.commits_count,
        prs_merged = excluded.prs_merged,
        avg_cycle_time_hours = COALESCE(excluded.avg_cycle_time_hours, engineer_patterns.avg_cycle_time_hours),
        ai_analysis = COALESCE(excluded.ai_analysis, engineer_patterns.ai_analysis)
    `).run(
      id,
      input.teamMemberId,
      input.weekStart,
      input.ticketsCompleted ?? 0,
      input.ticketsStarted ?? 0,
      input.commitsCount ?? 0,
      input.prsMerged ?? 0,
      input.avgCycleTimeHours ?? null,
      input.aiAnalysis ?? null,
    );
  }

  getEngineerPatterns(memberId: string, weeks = 8): any[] {
    return this.db.prepare(
      'SELECT * FROM engineer_patterns WHERE team_member_id = ? ORDER BY week_start DESC LIMIT ?'
    ).all(memberId, weeks) as any[];
  }

  // ============================================================================
  // Automation Engine
  // ============================================================================

  getAutomationConfig(): AutomationConfig {
    const row = this.db.prepare('SELECT * FROM automation_config WHERE id = ?').get('singleton') as any;
    return {
      id: row.id,
      enabled: Boolean(row.enabled),
      checkIntervalMinutes: row.check_interval_minutes,
      autoApproveThreshold: row.auto_approve_threshold,
      notifyOnNewActions: Boolean(row.notify_on_new_actions),
      updatedAt: row.updated_at,
    };
  }

  updateAutomationConfig(input: UpdateAutomationConfigInput): AutomationConfig {
    const updates: string[] = [];
    const params: any[] = [];

    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }
    if (input.checkIntervalMinutes !== undefined) {
      updates.push('check_interval_minutes = ?');
      params.push(input.checkIntervalMinutes);
    }
    if (input.autoApproveThreshold !== undefined) {
      updates.push('auto_approve_threshold = ?');
      params.push(input.autoApproveThreshold);
    }
    if (input.notifyOnNewActions !== undefined) {
      updates.push('notify_on_new_actions = ?');
      params.push(input.notifyOnNewActions ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE automation_config SET ${updates.join(', ')} WHERE id = 'singleton'`).run(...params);
    }

    return this.getAutomationConfig();
  }

  createAutomationRun(input: { id: string; checksRun: string[] }): AutomationRun {
    this.db.prepare(
      'INSERT INTO automation_runs (id, checks_run) VALUES (?, ?)'
    ).run(input.id, JSON.stringify(input.checksRun));
    return this.getAutomationRun(input.id)!;
  }

  getAutomationRun(id: string): AutomationRun | null {
    const row = this.db.prepare('SELECT * FROM automation_runs WHERE id = ?').get(id) as any;
    return row ? this.mapAutomationRunRow(row) : null;
  }

  updateAutomationRun(id: string, input: {
    status?: string;
    completedAt?: string;
    actionsProposed?: number;
    actionsAutoApproved?: number;
    error?: string;
  }): AutomationRun {
    const updates: string[] = [];
    const params: any[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.completedAt !== undefined) {
      updates.push('completed_at = ?');
      params.push(input.completedAt);
    }
    if (input.actionsProposed !== undefined) {
      updates.push('actions_proposed = ?');
      params.push(input.actionsProposed);
    }
    if (input.actionsAutoApproved !== undefined) {
      updates.push('actions_auto_approved = ?');
      params.push(input.actionsAutoApproved);
    }
    if (input.error !== undefined) {
      updates.push('error = ?');
      params.push(input.error);
    }

    if (updates.length > 0) {
      this.db.prepare(`UPDATE automation_runs SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
    }

    return this.getAutomationRun(id)!;
  }

  getAutomationRuns(limit = 20): AutomationRun[] {
    const rows = this.db.prepare('SELECT * FROM automation_runs ORDER BY started_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(this.mapAutomationRunRow);
  }

  createAutomationAction(input: {
    id: string;
    runId: string;
    type: string;
    checkModule: string;
    title: string;
    description: string;
    confidence: number;
    metadata: Record<string, any>;
  }): AutomationAction {
    this.db.prepare(
      'INSERT INTO automation_actions (id, run_id, type, check_module, title, description, confidence, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(input.id, input.runId, input.type, input.checkModule, input.title, input.description, input.confidence, JSON.stringify(input.metadata));
    return this.getAutomationAction(input.id)!;
  }

  getAutomationAction(id: string): AutomationAction | null {
    const row = this.db.prepare('SELECT * FROM automation_actions WHERE id = ?').get(id) as any;
    return row ? this.mapAutomationActionRow(row) : null;
  }

  getAutomationActions(filters?: { status?: AutomationActionStatus; type?: string; runId?: string }): AutomationAction[] {
    let query = 'SELECT * FROM automation_actions WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters?.runId) {
      query += ' AND run_id = ?';
      params.push(filters.runId);
    }

    query += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.mapAutomationActionRow);
  }

  updateAutomationActionStatus(id: string, status: AutomationActionStatus, resolvedBy: string): AutomationAction | null {
    this.db.prepare(
      "UPDATE automation_actions SET status = ?, resolved_at = datetime('now'), resolved_by = ? WHERE id = ?"
    ).run(status, resolvedBy, id);
    return this.getAutomationAction(id);
  }

  private mapAutomationRunRow(row: any): AutomationRun {
    return {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      checksRun: JSON.parse(row.checks_run || '[]'),
      actionsProposed: row.actions_proposed,
      actionsAutoApproved: row.actions_auto_approved,
      status: row.status,
      error: row.error,
    };
  }

  private mapAutomationActionRow(row: any): AutomationAction {
    return {
      id: row.id,
      runId: row.run_id,
      type: row.type,
      checkModule: row.check_module,
      title: row.title,
      description: row.description,
      confidence: row.confidence,
      status: row.status,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    };
  }

  // ============================================================================
  // Sprint Snapshot Methods
  // ============================================================================

  createSprintSnapshot(input: {
    id: string;
    sprintId: number;
    sprintName: string;
    snapshotDate: string;
    totalTickets: number;
    completedTickets: number;
    inProgressTickets: number;
    todoTickets: number;
    totalStoryPoints: number | null;
    completedStoryPoints: number | null;
    perEngineerData: any[];
    healthScore: number | null;
    aiAnalysis: string | null;
    daysRemaining: number | null;
  }): void {
    this.db.prepare(`
      INSERT INTO sprint_snapshots (id, sprint_id, sprint_name, snapshot_date, total_tickets, completed_tickets, in_progress_tickets, todo_tickets, total_story_points, completed_story_points, per_engineer_data, health_score, ai_analysis, days_remaining)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.sprintId,
      input.sprintName,
      input.snapshotDate,
      input.totalTickets,
      input.completedTickets,
      input.inProgressTickets,
      input.todoTickets,
      input.totalStoryPoints,
      input.completedStoryPoints,
      JSON.stringify(input.perEngineerData),
      input.healthScore,
      input.aiAnalysis,
      input.daysRemaining,
    );
  }

  getSprintSnapshots(sprintId?: number, limit = 20): {
    id: string;
    sprintId: number;
    sprintName: string;
    snapshotDate: string;
    totalTickets: number;
    completedTickets: number;
    inProgressTickets: number;
    todoTickets: number;
    totalStoryPoints: number | null;
    completedStoryPoints: number | null;
    perEngineerData: any[];
    healthScore: number | null;
    aiAnalysis: string | null;
    daysRemaining: number | null;
    createdAt: string;
  }[] {
    let query = 'SELECT * FROM sprint_snapshots';
    const params: any[] = [];

    if (sprintId !== undefined) {
      query += ' WHERE sprint_id = ?';
      params.push(sprintId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.mapSprintSnapshotRow);
  }

  getLatestSprintSnapshot(): {
    id: string;
    sprintId: number;
    sprintName: string;
    snapshotDate: string;
    totalTickets: number;
    completedTickets: number;
    inProgressTickets: number;
    todoTickets: number;
    totalStoryPoints: number | null;
    completedStoryPoints: number | null;
    perEngineerData: any[];
    healthScore: number | null;
    aiAnalysis: string | null;
    daysRemaining: number | null;
    createdAt: string;
  } | null {
    const row = this.db.prepare('SELECT * FROM sprint_snapshots ORDER BY created_at DESC LIMIT 1').get() as any;
    return row ? this.mapSprintSnapshotRow(row) : null;
  }

  private mapSprintSnapshotRow(row: any): {
    id: string;
    sprintId: number;
    sprintName: string;
    snapshotDate: string;
    totalTickets: number;
    completedTickets: number;
    inProgressTickets: number;
    todoTickets: number;
    totalStoryPoints: number | null;
    completedStoryPoints: number | null;
    perEngineerData: any[];
    healthScore: number | null;
    aiAnalysis: string | null;
    daysRemaining: number | null;
    createdAt: string;
  } {
    return {
      id: row.id,
      sprintId: row.sprint_id,
      sprintName: row.sprint_name,
      snapshotDate: row.snapshot_date,
      totalTickets: row.total_tickets,
      completedTickets: row.completed_tickets,
      inProgressTickets: row.in_progress_tickets,
      todoTickets: row.todo_tickets,
      totalStoryPoints: row.total_story_points,
      completedStoryPoints: row.completed_story_points,
      perEngineerData: JSON.parse(row.per_engineer_data || '[]'),
      healthScore: row.health_score,
      aiAnalysis: row.ai_analysis,
      daysRemaining: row.days_remaining,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Report Methods
  // ============================================================================

  createReport(input: {
    id: string;
    reportType: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    markdownContent: string;
    structuredData: any | null;
  }): void {
    this.db.prepare(`
      INSERT INTO reports (id, report_type, title, period_start, period_end, markdown_content, structured_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.reportType,
      input.title,
      input.periodStart,
      input.periodEnd,
      input.markdownContent,
      input.structuredData ? JSON.stringify(input.structuredData) : null,
    );
  }

  getReports(filters?: { type?: string; limit?: number }): {
    id: string;
    reportType: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    markdownContent: string;
    structuredData: any | null;
    createdAt: string;
  }[] {
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params: any[] = [];

    if (filters?.type) {
      query += ' AND report_type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters?.limit ?? 20);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.mapReportRow);
  }

  getReport(id: string): {
    id: string;
    reportType: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    markdownContent: string;
    structuredData: any | null;
    createdAt: string;
  } | null {
    const row = this.db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    return row ? this.mapReportRow(row) : null;
  }

  deleteReport(id: string): boolean {
    const result = this.db.prepare('DELETE FROM reports WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getReportTemplate(reportType: string): {
    id: string;
    reportType: string;
    sections: any[];
    customInstructions: string | null;
    updatedAt: string;
  } | null {
    const row = this.db.prepare('SELECT * FROM report_templates WHERE report_type = ?').get(reportType) as any;
    return row ? this.mapReportTemplateRow(row) : null;
  }

  upsertReportTemplate(input: {
    id: string;
    reportType: string;
    sections: any[];
    customInstructions?: string | null;
  }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO report_templates (id, report_type, sections, custom_instructions, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(
      input.id,
      input.reportType,
      JSON.stringify(input.sections),
      input.customInstructions ?? null,
    );
  }

  private mapReportRow(row: any): {
    id: string;
    reportType: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    markdownContent: string;
    structuredData: any | null;
    createdAt: string;
  } {
    return {
      id: row.id,
      reportType: row.report_type,
      title: row.title,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      markdownContent: row.markdown_content,
      structuredData: row.structured_data ? JSON.parse(row.structured_data) : null,
      createdAt: row.created_at,
    };
  }

  private mapReportTemplateRow(row: any): {
    id: string;
    reportType: string;
    sections: any[];
    customInstructions: string | null;
    updatedAt: string;
  } {
    return {
      id: row.id,
      reportType: row.report_type,
      sections: JSON.parse(row.sections || '[]'),
      customInstructions: row.custom_instructions,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Slack Config Methods
  // ============================================================================

  getSlackConfig(): SlackConfig | null {
    const row = this.db.prepare("SELECT * FROM slack_config WHERE id = 'singleton'").get() as any;
    if (!row) return null;
    return this.mapSlackConfigRow(row);
  }

  updateSlackConfig(input: UpdateSlackConfigInput): SlackConfig {
    const updates: string[] = [];
    const params: any[] = [];

    if (input.botToken !== undefined) {
      updates.push('bot_token = ?');
      params.push(input.botToken);
    }
    if (input.monitoredChannels !== undefined) {
      updates.push('monitored_channels = ?');
      params.push(JSON.stringify(input.monitoredChannels));
    }
    if (input.syncIntervalMinutes !== undefined) {
      updates.push('sync_interval_minutes = ?');
      params.push(input.syncIntervalMinutes);
    }
    if (input.messageRetentionDays !== undefined) {
      updates.push('message_retention_days = ?');
      params.push(input.messageRetentionDays);
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      this.db.prepare(`UPDATE slack_config SET ${updates.join(', ')} WHERE id = 'singleton'`).run(...params);
    }

    return this.getSlackConfig()!;
  }

  private mapSlackConfigRow(row: any): SlackConfig {
    return {
      id: row.id,
      botToken: row.bot_token ?? null,
      monitoredChannels: JSON.parse(row.monitored_channels || '[]'),
      syncIntervalMinutes: row.sync_interval_minutes,
      messageRetentionDays: row.message_retention_days,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Slack Channel Methods
  // ============================================================================

  getSlackChannels(monitoredOnly = false): SlackChannel[] {
    let query = 'SELECT * FROM slack_channels';
    if (monitoredOnly) {
      query += ' WHERE is_monitored = 1';
    }
    query += ' ORDER BY name ASC';
    const rows = this.db.prepare(query).all() as any[];
    return rows.map(this.mapSlackChannelRow);
  }

  getSlackChannel(id: string): SlackChannel | null {
    const row = this.db.prepare('SELECT * FROM slack_channels WHERE id = ?').get(id) as any;
    return row ? this.mapSlackChannelRow(row) : null;
  }

  upsertSlackChannel(input: { id: string; name: string; isMonitored?: boolean }): SlackChannel {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO slack_channels (id, name, is_monitored, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(input.id, input.name, input.isMonitored ? 1 : 0, now, now);
    return this.getSlackChannel(input.id)!;
  }

  updateSlackChannelMonitored(id: string, isMonitored: boolean): SlackChannel | null {
    const existing = this.getSlackChannel(id);
    if (!existing) return null;

    this.db.prepare(
      "UPDATE slack_channels SET is_monitored = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(isMonitored ? 1 : 0, id);
    return this.getSlackChannel(id);
  }

  updateSlackChannelCursor(id: string, cursor: string, messagesDelta: number): void {
    this.db.prepare(
      "UPDATE slack_channels SET last_sync_cursor = ?, message_count = message_count + ?, updated_at = datetime('now') WHERE id = ?"
    ).run(cursor, messagesDelta, id);
  }

  private mapSlackChannelRow(row: any): SlackChannel {
    return {
      id: row.id,
      name: row.name,
      isMonitored: row.is_monitored === 1,
      lastSyncCursor: row.last_sync_cursor ?? null,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Slack Message Methods
  // ============================================================================

  upsertSlackMessage(input: {
    id: string;
    channelId: string;
    userId: string | null;
    userName: string | null;
    text: string;
    threadTs: string | null;
    ts: string;
    jiraKeys: string[];
  }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO slack_messages (id, channel_id, user_id, user_name, text, thread_ts, ts, jira_keys, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        user_name = excluded.user_name,
        jira_keys = excluded.jira_keys
    `).run(
      input.id,
      input.channelId,
      input.userId,
      input.userName,
      input.text,
      input.threadTs,
      input.ts,
      JSON.stringify(input.jiraKeys),
      now
    );
  }

  getSlackMessages(channelId: string, limit = 50): SlackMessage[] {
    const rows = this.db.prepare(
      'SELECT * FROM slack_messages WHERE channel_id = ? ORDER BY ts DESC LIMIT ?'
    ).all(channelId, limit) as any[];
    return rows.map(this.mapSlackMessageRow);
  }

  deleteOldSlackMessages(cutoffDate: string): number {
    const result = this.db.prepare(
      'DELETE FROM slack_messages WHERE created_at < ?'
    ).run(cutoffDate);
    if (result.changes > 0) {
      console.log(`[slack-storage] Cleaned up ${result.changes} old messages`);
    }
    return result.changes;
  }

  private mapSlackMessageRow(row: any): SlackMessage {
    return {
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id ?? null,
      userName: row.user_name ?? null,
      text: row.text,
      threadTs: row.thread_ts ?? null,
      ts: row.ts,
      jiraKeys: JSON.parse(row.jira_keys || '[]'),
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Slack Thread Summary Methods
  // ============================================================================

  upsertSlackThreadSummary(input: {
    channelId: string;
    threadTs: string;
    summary: string;
    decisions: string[];
    actionItems: string[];
  }): SlackThreadSummary {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO slack_thread_summaries (id, channel_id, thread_ts, summary, decisions, action_items, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id, thread_ts) DO UPDATE SET
        summary = excluded.summary,
        decisions = excluded.decisions,
        action_items = excluded.action_items
    `).run(id, input.channelId, input.threadTs, input.summary, JSON.stringify(input.decisions), JSON.stringify(input.actionItems), now);

    return this.getSlackThreadSummary(input.channelId, input.threadTs)!;
  }

  getSlackThreadSummary(channelId: string, threadTs: string): SlackThreadSummary | null {
    const row = this.db.prepare(
      'SELECT * FROM slack_thread_summaries WHERE channel_id = ? AND thread_ts = ?'
    ).get(channelId, threadTs) as any;
    return row ? this.mapSlackThreadSummaryRow(row) : null;
  }

  private mapSlackThreadSummaryRow(row: any): SlackThreadSummary {
    return {
      id: row.id,
      channelId: row.channel_id,
      threadTs: row.thread_ts,
      summary: row.summary,
      decisions: JSON.parse(row.decisions || '[]'),
      actionItems: JSON.parse(row.action_items || '[]'),
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Slack Insight Methods
  // ============================================================================

  createSlackInsight(input: {
    id: string;
    type: SlackInsightType;
    content: string;
    channelId: string;
    messageTs: string;
    jiraKey: string | null;
    teamMemberId: string | null;
  }): SlackInsight {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO slack_insights (id, type, content, channel_id, message_ts, jira_key, team_member_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.type, input.content, input.channelId, input.messageTs, input.jiraKey, input.teamMemberId, now);
    return this.getSlackInsight(input.id)!;
  }

  getSlackInsight(id: string): SlackInsight | null {
    const row = this.db.prepare('SELECT * FROM slack_insights WHERE id = ?').get(id) as any;
    return row ? this.mapSlackInsightRow(row) : null;
  }

  getSlackInsights(filters?: {
    type?: string;
    jiraKey?: string;
    channelId?: string;
    limit?: number;
  }): SlackInsight[] {
    let query = 'SELECT * FROM slack_insights WHERE 1=1';
    const params: any[] = [];

    if (filters?.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters?.jiraKey) {
      query += ' AND jira_key = ?';
      params.push(filters.jiraKey);
    }
    if (filters?.channelId) {
      query += ' AND channel_id = ?';
      params.push(filters.channelId);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.mapSlackInsightRow);
  }

  private mapSlackInsightRow(row: any): SlackInsight {
    return {
      id: row.id,
      type: row.type as SlackInsightType,
      content: row.content,
      channelId: row.channel_id,
      messageTs: row.message_ts,
      jiraKey: row.jira_key ?? null,
      teamMemberId: row.team_member_id ?? null,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Slack User Mapping Methods
  // ============================================================================

  upsertSlackUserMapping(input: {
    slackUserId: string;
    slackDisplayName: string | null;
    teamMemberId?: string | null;
  }): SlackUserMapping {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO slack_user_mapping (slack_user_id, slack_display_name, team_member_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slack_user_id) DO UPDATE SET
        slack_display_name = excluded.slack_display_name
    `).run(input.slackUserId, input.slackDisplayName, input.teamMemberId ?? null, now);
    return this.getSlackUserMapping(input.slackUserId)!;
  }

  getSlackUserMapping(slackUserId: string): SlackUserMapping | null {
    const row = this.db.prepare('SELECT * FROM slack_user_mapping WHERE slack_user_id = ?').get(slackUserId) as any;
    return row ? this.mapSlackUserMappingRow(row) : null;
  }

  getSlackUserMappings(): SlackUserMapping[] {
    const rows = this.db.prepare('SELECT * FROM slack_user_mapping ORDER BY slack_display_name ASC').all() as any[];
    return rows.map(this.mapSlackUserMappingRow);
  }

  updateSlackUserMappingTeamMember(slackUserId: string, teamMemberId: string | null): SlackUserMapping | null {
    const existing = this.getSlackUserMapping(slackUserId);
    if (!existing) return null;

    this.db.prepare(
      'UPDATE slack_user_mapping SET team_member_id = ? WHERE slack_user_id = ?'
    ).run(teamMemberId, slackUserId);
    return this.getSlackUserMapping(slackUserId);
  }

  private mapSlackUserMappingRow(row: any): SlackUserMapping {
    return {
      slackUserId: row.slack_user_id,
      teamMemberId: row.team_member_id ?? null,
      slackDisplayName: row.slack_display_name ?? null,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Slack Sync State Methods
  // ============================================================================

  getSlackSyncState(): SlackSyncState {
    const row = this.db.prepare("SELECT * FROM slack_sync_state WHERE id = 'singleton'").get() as any;
    if (!row) {
      return {
        id: 'singleton',
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        isSyncing: false,
        errorCount: 0,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return this.mapSlackSyncStateRow(row);
  }

  updateSlackSyncState(input: {
    lastSyncAt?: string;
    lastSuccessfulSyncAt?: string;
    isSyncing?: boolean;
    errorCount?: number;
    lastError?: string | null;
  }): SlackSyncState {
    const updates: string[] = [];
    const params: any[] = [];

    if (input.lastSyncAt !== undefined) {
      updates.push('last_sync_at = ?');
      params.push(input.lastSyncAt);
    }
    if (input.lastSuccessfulSyncAt !== undefined) {
      updates.push('last_successful_sync_at = ?');
      params.push(input.lastSuccessfulSyncAt);
    }
    if (input.isSyncing !== undefined) {
      updates.push('is_syncing = ?');
      params.push(input.isSyncing ? 1 : 0);
    }
    if (input.errorCount !== undefined) {
      updates.push('error_count = ?');
      params.push(input.errorCount);
    }
    if (input.lastError !== undefined) {
      updates.push('last_error = ?');
      params.push(input.lastError);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      this.db.prepare(`UPDATE slack_sync_state SET ${updates.join(', ')} WHERE id = 'singleton'`).run(...params);
    }

    return this.getSlackSyncState();
  }

  private mapSlackSyncStateRow(row: any): SlackSyncState {
    return {
      id: row.id,
      lastSyncAt: row.last_sync_at ?? null,
      lastSuccessfulSyncAt: row.last_successful_sync_at ?? null,
      isSyncing: row.is_syncing === 1,
      errorCount: row.error_count,
      lastError: row.last_error ?? null,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // Stale Ticket Detection Methods (helpers)
  // ============================================================================

  getStaleDetection(id: string): { id: string; jiraKey: string; detectionType: string; severity: string; evidence: string; status: string; teamMemberId: string | null; createdAt: string; resolvedAt: string | null } | null {
    const row = this.db.prepare('SELECT * FROM stale_ticket_detections WHERE id = ?').get(id) as any;
    return row ? this.mapStaleDetectionRow(row) : null;
  }

  private mapStaleDetectionRow(row: any): { id: string; jiraKey: string; detectionType: string; severity: string; evidence: string; status: string; teamMemberId: string | null; createdAt: string; resolvedAt: string | null } {
    return {
      id: row.id,
      jiraKey: row.jira_key,
      detectionType: row.detection_type,
      severity: row.severity,
      evidence: row.evidence,
      status: row.status,
      teamMemberId: row.team_member_id,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  }

  // ============================================================================
  // Ticket Status History Methods (helpers)
  // ============================================================================

  private mapStatusHistoryRow(row: any): { id: string; jiraKey: string; oldStatus: string | null; newStatus: string; changedAt: string } {
    return {
      id: row.id,
      jiraKey: row.jira_key,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedAt: row.changed_at,
    };
  }

  // ============================================================================
  // Accountability Flag Methods (helpers)
  // ============================================================================

  getAccountabilityFlag(id: string): { id: string; teamMemberId: string; flagType: string; severity: string; message: string; metadata: any; status: string; createdAt: string; resolvedAt: string | null } | null {
    const row = this.db.prepare('SELECT * FROM accountability_flags WHERE id = ?').get(id) as any;
    return row ? this.mapAccountabilityFlagRow(row) : null;
  }

  private mapAccountabilityFlagRow(row: any): { id: string; teamMemberId: string; flagType: string; severity: string; message: string; metadata: any; status: string; createdAt: string; resolvedAt: string | null } {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      flagType: row.flag_type,
      severity: row.severity,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
    };
  }

  // ============================================================================
  // Engineer Pattern Methods (helpers)
  // ============================================================================

  private mapEngineerPatternRow(row: any): { id: string; teamMemberId: string; weekStart: string; ticketsCompleted: number; ticketsStarted: number; commitsCount: number; prsMerged: number; avgCycleTimeHours: number | null; aiAnalysis: string | null; createdAt: string } {
    return {
      id: row.id,
      teamMemberId: row.team_member_id,
      weekStart: row.week_start,
      ticketsCompleted: row.tickets_completed,
      ticketsStarted: row.tickets_started,
      commitsCount: row.commits_count,
      prsMerged: row.prs_merged,
      avgCycleTimeHours: row.avg_cycle_time_hours,
      aiAnalysis: row.ai_analysis,
      createdAt: row.created_at,
    };
  }

  // ============================================================================
  // Meeting Methods (additional)
  // ============================================================================

  createMeetingObjective(input: {
    id: string;
    meetingId: string;
    objective: string;
    ownerId?: string;
    dueDate?: string;
  }): { id: string; meetingId: string; objective: string; ownerId: string | null; dueDate: string | null; status: string; createdAt: string } {
    this.db.prepare(
      'INSERT INTO meeting_objectives (id, meeting_id, objective, owner_id, due_date) VALUES (?, ?, ?, ?, ?)'
    ).run(input.id, input.meetingId, input.objective, input.ownerId ?? null, input.dueDate ?? null);
    return this.mapMeetingObjectiveRow(
      this.db.prepare('SELECT * FROM meeting_objectives WHERE id = ?').get(input.id) as any
    );
  }

  getMeetingObjectives(meetingId: string): { id: string; meetingId: string; objective: string; ownerId: string | null; dueDate: string | null; status: string; createdAt: string }[] {
    const rows = this.db.prepare(
      'SELECT * FROM meeting_objectives WHERE meeting_id = ? ORDER BY created_at ASC'
    ).all(meetingId) as any[];
    return rows.map(this.mapMeetingObjectiveRow);
  }

  updateMeetingObjective(id: string, updates: { status?: string; ownerId?: string; dueDate?: string }): { id: string; meetingId: string; objective: string; ownerId: string | null; dueDate: string | null; status: string; createdAt: string } | null {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.ownerId !== undefined) {
      setClauses.push('owner_id = ?');
      params.push(updates.ownerId);
    }
    if (updates.dueDate !== undefined) {
      setClauses.push('due_date = ?');
      params.push(updates.dueDate);
    }

    if (setClauses.length === 0) return null;

    params.push(id);
    this.db.prepare(`UPDATE meeting_objectives SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    const row = this.db.prepare('SELECT * FROM meeting_objectives WHERE id = ?').get(id) as any;
    return row ? this.mapMeetingObjectiveRow(row) : null;
  }

  createMeetingDecision(input: {
    id: string;
    meetingId: string;
    decision: string;
    context?: string;
  }): { id: string; meetingId: string; decision: string; context: string | null; createdAt: string } {
    this.db.prepare(
      'INSERT INTO meeting_decisions (id, meeting_id, decision, context) VALUES (?, ?, ?, ?)'
    ).run(input.id, input.meetingId, input.decision, input.context ?? null);
    return this.mapMeetingDecisionRow(
      this.db.prepare('SELECT * FROM meeting_decisions WHERE id = ?').get(input.id) as any
    );
  }

  getMeetingDecisions(meetingId: string): { id: string; meetingId: string; decision: string; context: string | null; createdAt: string }[] {
    const rows = this.db.prepare(
      'SELECT * FROM meeting_decisions WHERE meeting_id = ? ORDER BY created_at ASC'
    ).all(meetingId) as any[];
    return rows.map(this.mapMeetingDecisionRow);
  }

  createMeetingActionItem(input: {
    id: string;
    meetingId: string;
    action: string;
    assigneeId?: string;
    dueDate?: string;
  }): { id: string; meetingId: string; action: string; assigneeId: string | null; dueDate: string | null; status: string; jiraTicketId: string | null; createdAt: string; updatedAt: string } {
    this.db.prepare(
      'INSERT INTO meeting_action_items (id, meeting_id, action, assignee_id, due_date) VALUES (?, ?, ?, ?, ?)'
    ).run(input.id, input.meetingId, input.action, input.assigneeId ?? null, input.dueDate ?? null);
    return this.mapMeetingActionItemRow(
      this.db.prepare('SELECT * FROM meeting_action_items WHERE id = ?').get(input.id) as any
    );
  }

  getMeetingActionItems(filters?: {
    meetingId?: string;
    assigneeId?: string;
    status?: string;
  }): { id: string; meetingId: string; action: string; assigneeId: string | null; dueDate: string | null; status: string; jiraTicketId: string | null; createdAt: string; updatedAt: string }[] {
    let query = 'SELECT * FROM meeting_action_items WHERE 1=1';
    const params: any[] = [];

    if (filters?.meetingId) {
      query += ' AND meeting_id = ?';
      params.push(filters.meetingId);
    }
    if (filters?.assigneeId) {
      query += ' AND assignee_id = ?';
      params.push(filters.assigneeId);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at ASC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.mapMeetingActionItemRow);
  }

  private mapMeetingObjectiveRow(row: any): { id: string; meetingId: string; objective: string; ownerId: string | null; dueDate: string | null; status: string; createdAt: string } {
    return {
      id: row.id,
      meetingId: row.meeting_id,
      objective: row.objective,
      ownerId: row.owner_id,
      dueDate: row.due_date,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  private mapMeetingDecisionRow(row: any): { id: string; meetingId: string; decision: string; context: string | null; createdAt: string } {
    return {
      id: row.id,
      meetingId: row.meeting_id,
      decision: row.decision,
      context: row.context,
      createdAt: row.created_at,
    };
  }

  private mapMeetingActionItemRow(row: any): { id: string; meetingId: string; action: string; assigneeId: string | null; dueDate: string | null; status: string; jiraTicketId: string | null; createdAt: string; updatedAt: string } {
    return {
      id: row.id,
      meetingId: row.meeting_id,
      action: row.action,
      assigneeId: row.assignee_id,
      dueDate: row.due_date,
      status: row.status,
      jiraTicketId: row.jira_ticket_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Jira sync failure methods
  createSyncFailure(input: { id: string; entityType: string; entityId: string; jiraKey?: string; errorMessage: string }): any {
    this.db.prepare(`
      INSERT INTO jira_sync_failures (id, entity_type, entity_id, jira_key, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.id, input.entityType, input.entityId, input.jiraKey ?? null, input.errorMessage);
    return this.db.prepare('SELECT * FROM jira_sync_failures WHERE id = ?').get(input.id);
  }

  getSyncFailures(options?: { resolved?: boolean; entityType?: string }): any[] {
    let query = 'SELECT * FROM jira_sync_failures WHERE 1=1';
    const params: any[] = [];

    if (options?.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(options.resolved ? 1 : 0);
    }
    if (options?.entityType) {
      query += ' AND entity_type = ?';
      params.push(options.entityType);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.prepare(query).all(...params) as any[];
  }

  resolveSyncFailure(id: string): void {
    const stmt = this.db.prepare('UPDATE jira_sync_failures SET resolved = 1 WHERE id = ?');
    stmt.run(id);
  }

  incrementSyncFailureRetry(id: string): void {
    const stmt = this.db.prepare('UPDATE jira_sync_failures SET retry_count = retry_count + 1 WHERE id = ?');
    stmt.run(id);
  }

  updateTicketJiraSyncedAt(ticketId: string): void {
    const stmt = this.db.prepare("UPDATE tickets SET jira_synced_at = datetime('now') WHERE id = ?");
    stmt.run(ticketId);
  }

  close() {
    this.db.close();
  }
}

export const createStorageService = (dbPath: string) => new StorageService(dbPath);
export type { StorageService };
