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
  WorldConfig,
  WorldState,
  CampaignRegion,
  MemberProgress,
  JiraSyncState,
  LevelUpEvent,
  UpdateWorldConfigInput,
  CreateCampaignRegionInput,
  UpdateJiraSyncConfigInput,
  PMDashboardData,
  EngineerStatus,
  PMAlert,
  PMAssignment,
  AITicketSuggestion,
  PMConfig,
  CreatePMAssignmentInput,
  UpdatePMConfigInput,
  MemberTicket,
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

export async function getRelatedTickets(id: string): Promise<{ tickets: Ticket[] }> {
  return fetchApi<{ tickets: Ticket[] }>(`/tickets/${id}/related`);
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

// Update ticket skill status (accept/reject AI-inferred skill)
export async function updateTicketSkillStatus(
  ticketId: string,
  skill: string,
  status: 'accepted' | 'rejected'
): Promise<{ ticket: Ticket }> {
  return fetchApi<{ ticket: Ticket }>(`/tickets/${ticketId}/skills`, {
    method: 'PATCH',
    body: JSON.stringify({ skill, status }),
  });
}

// ============================================================================
// World API
// ============================================================================

// Get world configuration
export async function getWorldConfig(): Promise<WorldConfig> {
  return fetchApi<WorldConfig>('/world/config');
}

// Update world configuration
export async function updateWorldConfig(input: UpdateWorldConfigInput): Promise<WorldConfig> {
  return fetchApi<WorldConfig>('/world/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Get full world state
export async function getWorldState(): Promise<WorldState> {
  return fetchApi<WorldState>('/world/state');
}

// Get campaign regions
export async function getCampaignRegions(): Promise<CampaignRegion[]> {
  return fetchApi<CampaignRegion[]>('/world/regions');
}

// Create a campaign region
export async function createCampaignRegion(input: CreateCampaignRegionInput): Promise<CampaignRegion> {
  return fetchApi<CampaignRegion>('/world/regions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Update a campaign region
export async function updateCampaignRegion(
  id: string,
  input: Partial<CreateCampaignRegionInput>
): Promise<CampaignRegion> {
  return fetchApi<CampaignRegion>(`/world/regions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Delete a campaign region
export async function deleteCampaignRegion(id: string): Promise<void> {
  await fetchApi<{ deleted: true }>(`/world/regions/${id}`, {
    method: 'DELETE',
  });
}

// Auto-generate regions for all epics
export async function autoGenerateRegions(): Promise<{ created: number; regions: CampaignRegion[] }> {
  return fetchApi<{ created: number; regions: CampaignRegion[] }>('/world/regions/auto-generate', {
    method: 'POST',
  });
}

// Update member position
export async function updateMemberPosition(
  memberId: string,
  position: { x: number; y: number }
): Promise<TeamMember> {
  return fetchApi<TeamMember>(`/team/${memberId}/position`, {
    method: 'PUT',
    body: JSON.stringify(position),
  });
}

// Get member progress
export async function getMemberProgress(memberId: string): Promise<MemberProgress> {
  return fetchApi<MemberProgress>(`/team/${memberId}/progress`);
}

// Get team leaderboard
export async function getTeamLeaderboard(): Promise<{
  id: string;
  name: string;
  role: string;
  xp: number;
  level: number;
  title: string;
  ticketsCompleted: number;
}[]> {
  return fetchApi('/team/leaderboard');
}

// ============================================================================
// Sync API
// ============================================================================

// Get sync status
export async function getSyncStatus(): Promise<{
  isRunning: boolean;
  syncState: JiraSyncState;
  hasTimer: boolean;
}> {
  return fetchApi('/sync/status');
}

// Update sync configuration
export async function updateSyncConfig(input: UpdateJiraSyncConfigInput): Promise<JiraSyncState> {
  return fetchApi<JiraSyncState>('/sync/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Trigger manual sync
export async function triggerSync(): Promise<{
  success: boolean;
  ticketsProcessed: number;
  xpAwarded: number;
  error?: string;
}> {
  return fetchApi('/sync/trigger', {
    method: 'POST',
  });
}

// Get leaderboard from sync endpoint
export async function getSyncLeaderboard(): Promise<(MemberProgress & {
  memberName: string;
  memberRole: string;
})[]> {
  return fetchApi('/sync/leaderboard');
}

// Get unacknowledged level-up events
export async function getUnacknowledgedLevelUps(): Promise<LevelUpEvent[]> {
  return fetchApi('/sync/level-ups');
}

// Acknowledge a level-up event
export async function acknowledgeLevelUp(id: string): Promise<void> {
  await fetchApi<{ acknowledged: true }>(`/sync/level-ups/${id}/acknowledge`, {
    method: 'POST',
  });
}

// Get ticket completions
export async function getTicketCompletions(memberId?: string): Promise<{
  id: string;
  jiraKey: string;
  teamMemberId: string | null;
  completedAt: string;
  xpAwarded: number;
  completionSource: 'jira_sync' | 'manual';
  createdAt: string;
}[]> {
  const params = memberId ? `?memberId=${memberId}` : '';
  return fetchApi(`/sync/completions${params}`);
}

// ============================================================================
// PM API
// ============================================================================

// Get PM dashboard data
export async function getPMDashboard(): Promise<PMDashboardData> {
  return fetchApi<PMDashboardData>('/pm/dashboard');
}

// Get all engineers with status
export async function getPMEngineers(): Promise<EngineerStatus[]> {
  return fetchApi<EngineerStatus[]>('/pm/engineers');
}

// Get single engineer status
export async function getPMEngineerStatus(id: string): Promise<EngineerStatus> {
  return fetchApi<EngineerStatus>(`/pm/engineers/${id}`);
}

// Get active alerts
export async function getPMAlerts(): Promise<PMAlert[]> {
  return fetchApi<PMAlert[]>('/pm/alerts');
}

// Dismiss an alert
export async function dismissPMAlert(id: string): Promise<void> {
  await fetchApi<{ dismissed: true }>(`/pm/alerts/${id}/dismiss`, {
    method: 'POST',
  });
}

// Get assignment history
export async function getPMAssignments(filters?: {
  assigneeId?: string;
  completed?: boolean;
}): Promise<PMAssignment[]> {
  const params = new URLSearchParams();
  if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters?.completed !== undefined) params.set('completed', String(filters.completed));
  const query = params.toString();
  return fetchApi<PMAssignment[]>(`/pm/assignments${query ? `?${query}` : ''}`);
}

// Record new assignment
export async function createPMAssignment(input: CreatePMAssignmentInput): Promise<PMAssignment> {
  return fetchApi<PMAssignment>('/pm/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Complete an assignment
export async function completePMAssignment(id: string): Promise<PMAssignment> {
  return fetchApi<PMAssignment>(`/pm/assignments/${id}/complete`, {
    method: 'POST',
  });
}

// Get pending suggestions
export async function getPMSuggestions(memberId?: string): Promise<AITicketSuggestion[]> {
  const params = memberId ? `?memberId=${memberId}` : '';
  return fetchApi<AITicketSuggestion[]>(`/pm/suggestions${params}`);
}

// Generate new suggestions for a member
export async function generatePMSuggestions(memberId: string): Promise<AITicketSuggestion[]> {
  return fetchApi<AITicketSuggestion[]>(`/pm/suggestions/generate/${memberId}`, {
    method: 'POST',
  });
}

// Approve a suggestion
export async function approvePMSuggestion(id: string): Promise<{
  suggestion: AITicketSuggestion;
  assignment: PMAssignment;
}> {
  return fetchApi(`/pm/suggestions/${id}/approve`, {
    method: 'POST',
  });
}

// Reject a suggestion
export async function rejectPMSuggestion(id: string): Promise<AITicketSuggestion> {
  return fetchApi<AITicketSuggestion>(`/pm/suggestions/${id}/reject`, {
    method: 'POST',
  });
}

// Get PM config
export async function getPMConfig(): Promise<PMConfig> {
  return fetchApi<PMConfig>('/pm/config');
}

// Update PM config
export async function updatePMConfig(updates: UpdatePMConfigInput): Promise<PMConfig> {
  return fetchApi<PMConfig>('/pm/config', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Get PM service status
export async function getPMStatus(): Promise<{
  isRunning: boolean;
  hasTimer: boolean;
  config: PMConfig;
}> {
  return fetchApi('/pm/status');
}

// Trigger manual PM check
export async function triggerPMCheck(): Promise<{
  alertsCreated: number;
  suggestionsGenerated: number;
}> {
  return fetchApi('/pm/check', {
    method: 'POST',
  });
}

// ============================================================================
// Member Tickets API
// ============================================================================

// Get tickets for a specific team member (character screen)
export async function getMemberTickets(accountId: string): Promise<{ tickets: MemberTicket[] }> {
  return fetchApi<{ tickets: MemberTicket[] }>(`/jira/members/${accountId}/tickets`);
}
