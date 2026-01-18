import type {
  Ticket,
  TeamMember,
  Epic,
  JiraConfig,
  JiraCreateIssueResponse,
  JiraTestConnectionResponse,
  JiraUser,
  JiraSprint,
  JiraEpic,
  TicketType,
  TicketPriority,
} from '@jira-planner/shared';

// Map app ticket types to Jira issue types
const ticketTypeToJiraType: Record<TicketType, string> = {
  feature: 'Story',
  bug: 'Bug',
  improvement: 'Improvement',
  task: 'Task',
  design: 'Task', // Design maps to Task in Jira, but routes to design board
};

// Map ticket types to Jira Work Type field values
const ticketTypeToWorkType: Record<TicketType, string> = {
  feature: 'Development',
  bug: 'Development',
  improvement: 'Development',
  task: 'Development',
  design: 'Design',
};

// Map app priorities to Jira priorities
const priorityToJiraPriority: Record<TicketPriority, string> = {
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest',
};

interface JiraServiceConfig {
  email: string;
  apiToken: string;
}

export class JiraService {
  private email: string;
  private apiToken: string;

  constructor(config: JiraServiceConfig) {
    this.email = config.email;
    this.apiToken = config.apiToken;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retries = 3,
    delay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage = `Jira API error: ${response.status} ${response.statusText}`;
          try {
            const errorJson = JSON.parse(errorBody);
            if (errorJson.errorMessages) {
              errorMessage = errorJson.errorMessages.join(', ');
            } else if (errorJson.errors) {
              errorMessage = Object.values(errorJson.errors).join(', ');
            }
          } catch {
            if (errorBody) {
              errorMessage = errorBody;
            }
          }
          throw new Error(errorMessage);
        }

        return response.json();
      } catch (error) {
        if (attempt === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async testConnection(config: JiraConfig): Promise<JiraTestConnectionResponse> {
    try {
      const url = `${config.baseUrl}/rest/api/3/project/${config.projectKey}`;
      const result = await this.fetchWithRetry<{ name: string }>(url, { method: 'GET' });
      return {
        success: true,
        projectName: result.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async lookupUser(config: JiraConfig, username: string): Promise<JiraUser | null> {
    try {
      const url = `${config.baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(username)}`;
      const users = await this.fetchWithRetry<JiraUser[]>(url, { method: 'GET' });
      return users.length > 0 ? users[0] : null;
    } catch {
      return null;
    }
  }

  async getAssignableUsers(config: JiraConfig): Promise<JiraUser[]> {
    try {
      const url = `${config.baseUrl}/rest/api/3/user/assignable/search?project=${encodeURIComponent(config.projectKey)}&maxResults=1000`;
      const users = await this.fetchWithRetry<JiraUser[]>(url, { method: 'GET' });
      return users;
    } catch (error) {
      console.error('Failed to fetch assignable users:', error);
      return [];
    }
  }

  async getSprints(config: JiraConfig, boardId: number): Promise<JiraSprint[]> {
    try {
      // Jira Agile API for board sprints
      const url = `${config.baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`;
      const response = await this.fetchWithRetry<{ values: any[] }>(url, { method: 'GET' });

      return response.values.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state as 'active' | 'future' | 'closed',
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        boardId: boardId,
      }));
    } catch (error) {
      console.error(`Failed to fetch sprints for board ${boardId}:`, error);
      return [];
    }
  }

  async getEpics(config: JiraConfig): Promise<JiraEpic[]> {
    const allEpics: JiraEpic[] = [];
    const maxResults = 100;

    // Build JQL query with filters
    const jqlParts = [
      `project = ${config.projectKey}`,
      `issuetype = Epic`,
      `status NOT IN (Done, Closed)`, // Active epics only
    ];

    // Add team filter if configured
    if (config.teamFieldId && config.teamValue) {
      jqlParts.push(`"${config.teamFieldId}" = "${config.teamValue}"`);
    }

    const jql = jqlParts.join(' AND ') + ' ORDER BY key ASC';
    console.log(`Epic JQL query: ${jql}`);

    // Primary: Use JQL with pagination
    try {
      let startAt = 0;
      let total = 0;

      do {
        // Use new POST-based search/jql endpoint (old GET endpoint deprecated)
        const url = `${config.baseUrl}/rest/api/3/search/jql`;
        const response = await this.fetchWithRetry<{
          issues: { id: string; key: string; fields: { summary: string } }[];
          total: number;
          startAt: number;
        }>(url, {
          method: 'POST',
          body: JSON.stringify({
            jql,
            startAt,
            maxResults,
            fields: ['summary', 'key'],
          }),
        });

        total = response.total;

        allEpics.push(
          ...response.issues.map((issue) => ({
            id: issue.id,
            key: issue.key,
            name: issue.fields.summary,
            summary: issue.fields.summary,
          }))
        );

        startAt += maxResults;
        console.log(`Fetched ${allEpics.length}/${total} epics...`);
      } while (startAt < total);

      console.log(`JQL returned ${allEpics.length} active epics`);
      return allEpics;
    } catch (error) {
      console.error('JQL epic fetch failed:', error);
    }

    // Fallback: Agile API (no team filter, just done=false)
    if (config.defaultBoardId) {
      try {
        let startAt = 0;
        let isLast = false;

        while (!isLast) {
          const url = `${config.baseUrl}/rest/agile/1.0/board/${config.defaultBoardId}/epic?done=false&startAt=${startAt}&maxResults=${maxResults}`;
          const response = await this.fetchWithRetry<{
            values: { id: number; key: string; name: string; summary: string }[];
            isLast: boolean;
          }>(url, { method: 'GET' });

          if (response.values) {
            allEpics.push(
              ...response.values.map((epic) => ({
                id: epic.id.toString(),
                key: epic.key,
                name: epic.name || epic.summary,
                summary: epic.summary,
              }))
            );
          }

          isLast = response.isLast || !response.values?.length;
          startAt += maxResults;
        }

        console.log(`Agile API returned ${allEpics.length} active epics (no team filter applied)`);
        return allEpics;
      } catch (error) {
        console.error('Agile API epic fetch also failed:', error);
      }
    }

    return [];
  }

  async getFieldId(config: JiraConfig, fieldName: string): Promise<string | null> {
    try {
      const url = `${config.baseUrl}/rest/api/3/field`;
      const fields = await this.fetchWithRetry<{ id: string; name: string; custom: boolean }[]>(url, { method: 'GET' });

      const field = fields.find(
        (f) => f.name.toLowerCase() === fieldName.toLowerCase() || f.id.toLowerCase() === fieldName.toLowerCase()
      );
      return field?.id ?? null;
    } catch (error) {
      console.error(`Failed to find field "${fieldName}":`, error);
      return null;
    }
  }

  async addIssueToSprint(config: JiraConfig, issueId: string, sprintId: number): Promise<boolean> {
    try {
      const url = `${config.baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue`;
      await this.fetchWithRetry<void>(url, {
        method: 'POST',
        body: JSON.stringify({ issues: [issueId] }),
      });
      return true;
    } catch (error) {
      console.error(`Failed to add issue ${issueId} to sprint ${sprintId}:`, error);
      return false;
    }
  }

  private formatDescription(ticket: Ticket): string {
    // Format description in Jira wiki markup (ADF format for Jira Cloud)
    const parts: string[] = [];

    parts.push(ticket.description);

    if (ticket.acceptanceCriteria.length > 0) {
      parts.push('\n\n*Acceptance Criteria:*');
      ticket.acceptanceCriteria.forEach((criterion, index) => {
        parts.push(`# ${criterion}`);
      });
    }

    return parts.join('\n');
  }

  private formatDescriptionADF(ticket: Ticket): object {
    // Format description in Atlassian Document Format (ADF) for Jira Cloud
    const content: object[] = [];

    // Main description paragraph
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: ticket.description }],
    });

    // Acceptance criteria section
    if (ticket.acceptanceCriteria.length > 0) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Acceptance Criteria:', marks: [{ type: 'strong' }] },
        ],
      });

      content.push({
        type: 'orderedList',
        content: ticket.acceptanceCriteria.map((criterion) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: criterion }],
            },
          ],
        })),
      });
    }

    return {
      type: 'doc',
      version: 1,
      content,
    };
  }

  async createIssue(
    config: JiraConfig,
    ticket: Ticket,
    context: { teamMembers: TeamMember[]; epics: Epic[] },
    options?: { sprintId?: number }
  ): Promise<JiraCreateIssueResponse> {
    const url = `${config.baseUrl}/rest/api/3/issue`;

    // Build the fields object
    const fields: Record<string, any> = {
      project: { key: config.projectKey },
      summary: ticket.title,
      description: this.formatDescriptionADF(ticket),
      issuetype: { name: ticketTypeToJiraType[ticket.ticketType] },
      priority: { name: priorityToJiraPriority[ticket.priority] },
    };

    // Add parent (epic) link if ticket has an epic
    if (ticket.epicId) {
      const epic = context.epics.find((e) => e.id === ticket.epicId);
      if (epic) {
        // Use modern parent field format for Jira Cloud
        fields.parent = { key: epic.key };

        // Also set custom field if configured (for older Jira setups)
        if (config.epicLinkField) {
          fields[config.epicLinkField] = epic.key;
        }
      }
    }

    // Add Work Type field if configured
    if (config.workTypeFieldId) {
      const workType = ticketTypeToWorkType[ticket.ticketType];
      fields[config.workTypeFieldId] = { value: workType };
    }

    // Add assignee if ticket has one
    if (ticket.assigneeId) {
      const member = context.teamMembers.find((m) => m.id === ticket.assigneeId);
      if (member?.jiraUsername) {
        const jiraUser = await this.lookupUser(config, member.jiraUsername);
        if (jiraUser) {
          fields.assignee = { accountId: jiraUser.accountId };
        }
      }
    }

    // Add labels if present
    if (ticket.labels && ticket.labels.length > 0) {
      fields.labels = ticket.labels;
    }

    const response = await this.fetchWithRetry<JiraCreateIssueResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });

    // Add to sprint if specified (this is done after creation via Agile API)
    if (options?.sprintId) {
      await this.addIssueToSprint(config, response.id, options.sprintId);
    }

    return response;
  }

  // Get the board ID based on ticket type
  getBoardIdForTicketType(config: JiraConfig, ticketType: TicketType): number | null {
    if (ticketType === 'design' && config.designBoardId) {
      return config.designBoardId;
    }
    return config.defaultBoardId ?? null;
  }

  /**
   * Fetch recent tickets from Jira for learning purposes
   * Uses JQL to query tickets with various fields for analysis
   * Note: Uses the new /rest/api/3/search/jql POST endpoint (old GET endpoint deprecated)
   */
  async getRecentTickets(
    config: JiraConfig,
    options: {
      maxResults?: number;
      jql?: string;
      includeFields?: string[];
    } = {}
  ): Promise<JiraTicketForLearning[]> {
    try {
      const { maxResults = 100, includeFields = [] } = options;

      // Default JQL: recent tickets from the project
      const jql =
        options.jql ||
        `project = ${config.projectKey} AND issuetype != Epic ORDER BY updated DESC`;

      const fields = [
        'summary',
        'description',
        'issuetype',
        'priority',
        'assignee',
        'status',
        'created',
        'updated',
        'labels',
        'components',
        ...(config.epicLinkField ? [config.epicLinkField] : []),
        ...includeFields,
      ];

      // Use new POST-based search/jql endpoint
      const url = `${config.baseUrl}/rest/api/3/search/jql`;
      const response = await this.fetchWithRetry<{
        issues: any[];
        total: number;
      }>(url, {
        method: 'POST',
        body: JSON.stringify({
          jql,
          maxResults,
          fields,
        }),
      });

      return response.issues.map((issue) => this.mapJiraIssueToLearningTicket(issue, config));
    } catch (error) {
      console.error('Failed to fetch recent tickets:', error);
      return [];
    }
  }

  /**
   * Fetch tickets by assignee for skill inference
   */
  async getTicketsByAssignee(
    config: JiraConfig,
    accountId: string,
    options: { maxResults?: number } = {}
  ): Promise<JiraTicketForLearning[]> {
    const { maxResults = 50 } = options;
    const jql = `project = ${config.projectKey} AND assignee = "${accountId}" AND status in (Done, Closed, Resolved) ORDER BY updated DESC`;

    return this.getRecentTickets(config, { jql, maxResults });
  }

  /**
   * Fetch tickets by epic for epic categorization
   */
  async getTicketsByEpic(
    config: JiraConfig,
    epicKey: string,
    options: { maxResults?: number } = {}
  ): Promise<JiraTicketForLearning[]> {
    const { maxResults = 50 } = options;

    // Use the parent link or epic link field depending on Jira setup
    let jql: string;
    if (config.epicLinkField) {
      jql = `project = ${config.projectKey} AND "${config.epicLinkField}" = "${epicKey}" ORDER BY updated DESC`;
    } else {
      jql = `project = ${config.projectKey} AND parent = "${epicKey}" ORDER BY updated DESC`;
    }

    return this.getRecentTickets(config, { jql, maxResults });
  }

  private mapJiraIssueToLearningTicket(issue: any, config: JiraConfig): JiraTicketForLearning {
    const fields = issue.fields;

    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary || '',
      description: this.extractTextFromADF(fields.description),
      issueType: fields.issuetype?.name || 'Unknown',
      priority: fields.priority?.name || 'Medium',
      status: fields.status?.name || 'Unknown',
      assignee: fields.assignee
        ? {
            accountId: fields.assignee.accountId,
            displayName: fields.assignee.displayName,
          }
        : null,
      epicKey: config.epicLinkField ? fields[config.epicLinkField] : null,
      labels: fields.labels || [],
      components: (fields.components || []).map((c: any) => c.name),
      created: fields.created,
      updated: fields.updated,
    };
  }

  private extractTextFromADF(adfContent: any): string {
    if (!adfContent) return '';
    if (typeof adfContent === 'string') return adfContent;

    // Extract text from Atlassian Document Format
    const extractText = (node: any): string => {
      if (!node) return '';

      if (node.type === 'text') {
        return node.text || '';
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('');
      }

      return '';
    };

    return extractText(adfContent);
  }
}

// Type for tickets fetched for learning purposes
export interface JiraTicketForLearning {
  id: string;
  key: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  status: string;
  assignee: { accountId: string; displayName: string } | null;
  epicKey: string | null;
  labels: string[];
  components: string[];
  created: string;
  updated: string;
}

export const createJiraService = (): JiraService | null => {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    return null;
  }

  return new JiraService({ email, apiToken });
};
