export interface JiraConfig {
  id: string;
  baseUrl: string;
  projectKey: string;
  epicLinkField?: string; // Custom field ID for epic link (e.g., "customfield_10014")
  teamName?: string; // Team name for display (e.g., "Squad - DI")
  defaultBoardId?: number; // Default board ID for most ticket types (e.g., 90)
  designBoardId?: number; // Board ID for design tickets (e.g., 74)
  workTypeFieldId?: string; // Custom field ID for work type (determines board routing)
  teamFieldId?: string; // Custom field ID for Team filter (e.g., "customfield_10001")
  teamValue?: string; // Value to filter epics by (e.g., "Squad - DI")
  createdAt: string;
  updatedAt: string;
}

export interface JiraConfigInput {
  baseUrl: string;
  projectKey: string;
  epicLinkField?: string;
  teamName?: string;
  defaultBoardId?: number;
  designBoardId?: number;
  workTypeFieldId?: string;
  teamFieldId?: string;
  teamValue?: string;
}

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

export interface JiraTestConnectionResponse {
  success: boolean;
  projectName?: string;
  error?: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
}

export interface JiraPriority {
  id: string;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;
  endDate?: string;
  boardId: number;
}

export interface JiraEpic {
  id: string;
  key: string;
  name: string;
  summary: string;
}

export interface JiraSyncResult {
  users: { synced: number; total: number };
  epics: { synced: number; total: number };
  sprints?: { synced: number; total: number };
}
