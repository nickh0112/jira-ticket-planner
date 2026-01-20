import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
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
    this.runMigrations();
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
      INSERT INTO team_members (id, name, role, skills, jira_username, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.role, JSON.stringify(input.skills), input.jiraUsername ?? null, now, now);
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

  private mapTeamMemberRow(row: any): TeamMember {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      skills: JSON.parse(row.skills),
      jiraUsername: row.jira_username ?? undefined,
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
            regression_default_value = ?, updated_at = ?
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
                                 regression_default_value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  close() {
    this.db.close();
  }
}

export const createStorageService = (dbPath: string) => new StorageService(dbPath);
export type { StorageService };
