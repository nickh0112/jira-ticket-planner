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
  }

  // Ticket methods
  createTicket(input: CreateTicketInput): Ticket {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO tickets (id, title, description, acceptance_criteria, ticket_type, priority, epic_id, assignee_id, labels, required_skills, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  close() {
    this.db.close();
  }
}

export const createStorageService = (dbPath: string) => new StorageService(dbPath);
export type { StorageService };
