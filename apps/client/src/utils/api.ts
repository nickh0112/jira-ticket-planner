import type {
  ApiResponse,
  Ticket,
  TeamMember,
  Epic,
  UpdateTicketInput,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
  CreateEpicInput,
  UpdateEpicInput,
  TicketStatus,
  JiraConfig,
  JiraConfigInput,
  JiraTestConnectionResponse,
  JiraCreateIssueResponse,
  JiraUser,
  JiraSprint,
  JiraEpic,
  JiraSyncResult,
  LearningResult,
  AgentKnowledgeResponse,
  EnhanceTicketResponse,
  EpicSuggestion,
  AssigneeSuggestion,
  AgentOptions,
  EnhancedTicket,
} from '@jira-planner/shared';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'API request failed');
  }

  return result.data as T;
}

// Parse transcript
export async function parseTranscript(transcript: string): Promise<{ tickets: Ticket[] }> {
  return fetchApi<{ tickets: Ticket[] }>('/parse', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });
}

// Tickets
export async function getTickets(filters?: {
  status?: TicketStatus;
  epicId?: string;
  assigneeId?: string;
}): Promise<{ tickets: Ticket[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.epicId) params.set('epicId', filters.epicId);
  if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId);
  const query = params.toString();
  return fetchApi<{ tickets: Ticket[]; total: number }>(
    `/tickets${query ? `?${query}` : ''}`
  );
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput
): Promise<Ticket> {
  return fetchApi<Ticket>(`/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus
): Promise<Ticket> {
  return fetchApi<Ticket>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteTicket(id: string): Promise<void> {
  await fetchApi<{ deleted: boolean }>(`/tickets/${id}`, {
    method: 'DELETE',
  });
}

// Team Members
export async function getTeamMembers(): Promise<{ members: TeamMember[] }> {
  return fetchApi<{ members: TeamMember[] }>('/team');
}

export async function createTeamMember(
  input: CreateTeamMemberInput
): Promise<TeamMember> {
  return fetchApi<TeamMember>('/team', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput
): Promise<TeamMember> {
  return fetchApi<TeamMember>(`/team/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteTeamMember(id: string): Promise<void> {
  await fetchApi<{ deleted: boolean }>(`/team/${id}`, {
    method: 'DELETE',
  });
}

// Epics
export async function getEpics(): Promise<{ epics: Epic[] }> {
  return fetchApi<{ epics: Epic[] }>('/epics');
}

export async function createEpic(input: CreateEpicInput): Promise<Epic> {
  return fetchApi<Epic>('/epics', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateEpicApi(
  id: string,
  input: UpdateEpicInput
): Promise<Epic> {
  return fetchApi<Epic>(`/epics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteEpic(id: string): Promise<void> {
  await fetchApi<{ deleted: boolean }>(`/epics/${id}`, {
    method: 'DELETE',
  });
}

// Jira
export async function getJiraConfig(): Promise<{ config: JiraConfig | null }> {
  return fetchApi<{ config: JiraConfig | null }>('/jira/config');
}

export async function updateJiraConfig(input: JiraConfigInput): Promise<JiraConfig> {
  return fetchApi<JiraConfig>('/jira/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function testJiraConnection(): Promise<JiraTestConnectionResponse> {
  return fetchApi<JiraTestConnectionResponse>('/jira/test', {
    method: 'POST',
  });
}

export async function createJiraIssue(
  ticketId: string,
  options?: { sprintId?: number }
): Promise<{ ticket: Ticket; jira: JiraCreateIssueResponse }> {
  return fetchApi<{ ticket: Ticket; jira: JiraCreateIssueResponse }>(
    `/jira/tickets/${ticketId}/create`,
    {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }
  );
}

export async function createAllJiraIssues(): Promise<{
  results: { ticketId: string; success: boolean; jiraKey?: string; error?: string }[];
  total: number;
  successful: number;
}> {
  return fetchApi<{
    results: { ticketId: string; success: boolean; jiraKey?: string; error?: string }[];
    total: number;
    successful: number;
  }>('/jira/tickets/create-all', {
    method: 'POST',
  });
}

// Get assignable users from Jira
export async function getJiraUsers(): Promise<{ users: JiraUser[] }> {
  return fetchApi<{ users: JiraUser[] }>('/jira/users');
}

// Get sprints from Jira board
export async function getJiraSprints(boardId?: number): Promise<{ sprints: JiraSprint[] }> {
  const params = boardId ? `?boardId=${boardId}` : '';
  return fetchApi<{ sprints: JiraSprint[] }>(`/jira/sprints${params}`);
}

// Get cached sprints from local database
export async function getCachedSprints(boardId?: number): Promise<{ sprints: JiraSprint[] }> {
  const params = boardId ? `?boardId=${boardId}` : '';
  return fetchApi<{ sprints: JiraSprint[] }>(`/jira/sprints/cached${params}`);
}

// Get epics from Jira
export async function getJiraEpics(): Promise<{ epics: JiraEpic[] }> {
  return fetchApi<{ epics: JiraEpic[] }>('/jira/epics');
}

// Sync Jira data (users + epics) to local database
export async function syncJiraData(): Promise<JiraSyncResult> {
  return fetchApi<JiraSyncResult>('/jira/sync', {
    method: 'POST',
  });
}

// Agent API
// Trigger learning from Jira history
export async function triggerAgentLearning(): Promise<LearningResult> {
  return fetchApi<LearningResult>('/agent/learn', {
    method: 'POST',
  });
}

// Get agent knowledge base
export async function getAgentKnowledge(): Promise<AgentKnowledgeResponse> {
  return fetchApi<AgentKnowledgeResponse>('/agent/knowledge');
}

// Enhance a specific ticket
export async function enhanceTicket(
  ticketId: string,
  qualityThreshold?: 'basic' | 'standard' | 'comprehensive'
): Promise<EnhanceTicketResponse> {
  return fetchApi<EnhanceTicketResponse>(`/agent/enhance/${ticketId}`, {
    method: 'POST',
    body: JSON.stringify({ qualityThreshold }),
  });
}

// Get epic suggestions for a ticket
export async function suggestEpic(ticket: {
  title: string;
  description: string;
  ticketType: string;
}): Promise<EpicSuggestion> {
  return fetchApi<EpicSuggestion>('/agent/suggest-epic', {
    method: 'POST',
    body: JSON.stringify(ticket),
  });
}

// Get assignee suggestions for a ticket
export async function suggestAssignees(ticket: {
  title: string;
  description: string;
  ticketType: string;
  requiredSkills?: string[];
}): Promise<AssigneeSuggestion[]> {
  return fetchApi<AssigneeSuggestion[]>('/agent/suggest-assignee', {
    method: 'POST',
    body: JSON.stringify(ticket),
  });
}

// Process tickets with full agent enhancement pipeline
export async function processTicketsWithAgent(
  tickets: any[],
  options?: AgentOptions
): Promise<{
  tickets: EnhancedTicket[];
  pendingEpicProposals: EpicSuggestion[];
}> {
  return fetchApi<{
    tickets: EnhancedTicket[];
    pendingEpicProposals: EpicSuggestion[];
  }>('/agent/process', {
    method: 'POST',
    body: JSON.stringify({ tickets, options }),
  });
}

// Approve a pending epic proposal
export async function approveEpicProposal(
  proposalId: string
): Promise<{ epicId: string }> {
  return fetchApi<{ epicId: string }>(
    `/agent/epic-proposals/${proposalId}/approve`,
    {
      method: 'POST',
    }
  );
}

// Reject a pending epic proposal
export async function rejectEpicProposal(proposalId: string): Promise<void> {
  await fetchApi<{ success: true }>(`/agent/epic-proposals/${proposalId}/reject`, {
    method: 'POST',
  });
}
