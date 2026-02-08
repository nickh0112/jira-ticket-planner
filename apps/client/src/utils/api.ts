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
  EngineerDetailData,
  PMAlert,
  PMAssignment,
  AITicketSuggestion,
  PMConfig,
  CreatePMAssignmentInput,
  UpdatePMConfigInput,
  MemberTicket,
  IdeaSession,
  IdeaSessionFull,
  IdeaPRD,
  IdeaMessage,
  IdeaTicketProposal,
  SendMessageResponse,
  GeneratePRDResponse,
  GenerateTicketsResponse,
  ApproveProposalsResponse,
  UpdateIdeaSessionInput,
  UpdateIdeaPRDInput,
  UpdateTicketProposalInput,
  IdeasListResponse,
  ProjectContext,
  ProjectContextInput,
  AutomationConfig,
  AutomationRun,
  AutomationAction,
  UpdateAutomationConfigInput,
  Meeting,
  MeetingFull,
  MeetingProcessResult,
  CreateMeetingInput,
  MeetingActionItem,
  MeetingActionItemStatus,
  Report,
  GenerateReportInput,
  SlackConfig,
  UpdateSlackConfigInput,
  SlackChannel,
  SlackInsight,
  SlackUserMapping,
  SlackSyncState,
  SlackTestConnectionResponse,
  CodebaseContextListItem,
  CodebaseContext,
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

// Get engineer detail data (tickets, activity)
export async function getPMEngineerDetail(id: string): Promise<EngineerDetailData> {
  return fetchApi<EngineerDetailData>(`/pm/engineers/${id}/detail`);
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

// ============================================================================
// Ideas API (Forge)
// ============================================================================

// Get all idea sessions
export async function getIdeaSessions(status?: string): Promise<IdeasListResponse> {
  const params = status ? `?status=${status}` : '';
  return fetchApi<IdeasListResponse>(`/ideas${params}`);
}

// Create a new idea session
export async function createIdeaSession(title: string): Promise<IdeaSession> {
  return fetchApi<IdeaSession>('/ideas', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

// Get a single session with all data
export async function getIdeaSession(id: string): Promise<IdeaSessionFull> {
  return fetchApi<IdeaSessionFull>(`/ideas/${id}`);
}

// Update a session
export async function updateIdeaSession(id: string, updates: UpdateIdeaSessionInput): Promise<IdeaSession> {
  return fetchApi<IdeaSession>(`/ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Archive a session
export async function archiveIdeaSession(id: string): Promise<{ archived: true }> {
  return fetchApi<{ archived: true }>(`/ideas/${id}`, {
    method: 'DELETE',
  });
}

// Send a message and get AI response
export async function sendIdeaMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
  return fetchApi<SendMessageResponse>(`/ideas/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// Generate PRD from conversation
export async function generateIdeaPRD(sessionId: string): Promise<GeneratePRDResponse> {
  return fetchApi<GeneratePRDResponse>(`/ideas/${sessionId}/generate-prd`, {
    method: 'POST',
  });
}

// Update PRD directly
export async function updateIdeaPRD(sessionId: string, updates: UpdateIdeaPRDInput): Promise<IdeaPRD> {
  return fetchApi<IdeaPRD>(`/ideas/${sessionId}/prd`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Generate ticket proposals from PRD
export async function generateIdeaTickets(sessionId: string, codebaseContextId?: string): Promise<GenerateTicketsResponse> {
  return fetchApi<GenerateTicketsResponse>(`/ideas/${sessionId}/generate-tickets`, {
    method: 'POST',
    body: JSON.stringify({ codebaseContextId }),
  });
}

// Update a ticket proposal
export async function updateIdeaProposal(
  sessionId: string,
  proposalId: string,
  updates: UpdateTicketProposalInput
): Promise<IdeaTicketProposal> {
  return fetchApi<IdeaTicketProposal>(`/ideas/${sessionId}/proposals/${proposalId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Approve selected proposals and create tickets
export async function approveIdeaProposals(
  sessionId: string,
  proposalIds: string[],
  options?: { pushToJira?: boolean }
): Promise<ApproveProposalsResponse> {
  return fetchApi<ApproveProposalsResponse>(`/ideas/${sessionId}/proposals/approve`, {
    method: 'POST',
    body: JSON.stringify({ proposalIds, pushToJira: options?.pushToJira }),
  });
}

// Create ticket from action item and push to Jira
export async function createActionItemInJira(
  actionItemId: string
): Promise<{ ticket: any; jiraKey?: string }> {
  return fetchApi<{ ticket: any; jiraKey?: string }>(`/meetings/action-items/${actionItemId}/create-in-jira`, {
    method: 'POST',
  });
}

// Sync ticket enhancements to Jira
export async function syncTicketToJira(
  ticketId: string
): Promise<{ success: boolean; jiraKey?: string }> {
  return fetchApi<{ success: boolean; jiraKey?: string }>(`/agent/tickets/${ticketId}/sync-to-jira`, {
    method: 'POST',
  });
}

// Reject a proposal
export async function rejectIdeaProposal(sessionId: string, proposalId: string): Promise<IdeaTicketProposal> {
  return fetchApi<IdeaTicketProposal>(`/ideas/${sessionId}/proposals/${proposalId}/reject`, {
    method: 'POST',
  });
}

// Import a PRD from markdown
export async function importIdeaPRD(title: string, markdown: string): Promise<{
  session: IdeaSession;
  prd: IdeaPRD;
  message: IdeaMessage;
}> {
  return fetchApi<{ session: IdeaSession; prd: IdeaPRD; message: IdeaMessage }>('/ideas/import-prd', {
    method: 'POST',
    body: JSON.stringify({ title, markdown }),
  });
}

// ============================================================================
// Codebase Context API
// ============================================================================

export async function getCodebaseContexts(): Promise<CodebaseContextListItem[]> {
  return fetchApi<CodebaseContextListItem[]>('/codebase-context');
}

export async function uploadCodebaseContext(analysis: any): Promise<CodebaseContext> {
  return fetchApi<CodebaseContext>('/codebase-context', {
    method: 'POST',
    body: JSON.stringify(analysis),
  });
}

export async function deleteCodebaseContext(id: string): Promise<{ deleted: true }> {
  return fetchApi<{ deleted: true }>(`/codebase-context/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Settings API
// ============================================================================

// Get project context
export async function getProjectContext(): Promise<{ context: ProjectContext | null }> {
  return fetchApi<{ context: ProjectContext | null }>('/settings/project-context');
}

// Update project context
export async function updateProjectContext(context: ProjectContextInput): Promise<{ context: ProjectContext }> {
  return fetchApi<{ context: ProjectContext }>('/settings/project-context', {
    method: 'PUT',
    body: JSON.stringify({ context }),
  });
}

// ============================================================================
// Bitbucket API
// ============================================================================

import type {
  BitbucketConfig,
  CreateBitbucketConfigInput,
  BitbucketTestConnectionResponse,
  BitbucketRepo,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketPipeline,
  BitbucketSyncState,
  UpdateBitbucketSyncConfigInput,
  BitbucketWorkspaceMember,
  BitbucketEngineerMetrics,
  BitbucketLeaderboardEntry,
  BitbucketActivityItem,
} from '@jira-planner/shared';

// Get Bitbucket config
export async function getBitbucketConfig(): Promise<{ config: BitbucketConfig | null }> {
  const config = await fetchApi<BitbucketConfig | null>('/bitbucket/config');
  return { config };
}

// Save Bitbucket config
export async function saveBitbucketConfig(input: CreateBitbucketConfigInput): Promise<BitbucketConfig> {
  return fetchApi<BitbucketConfig>('/bitbucket/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Test Bitbucket connection
export async function testBitbucketConnection(): Promise<BitbucketTestConnectionResponse> {
  return fetchApi<BitbucketTestConnectionResponse>('/bitbucket/test', {
    method: 'POST',
  });
}

// Get workspace members for mapping
export async function getBitbucketWorkspaceMembers(): Promise<BitbucketWorkspaceMember[]> {
  return fetchApi<BitbucketWorkspaceMember[]>('/bitbucket/workspace-members');
}

// Auto-map team members to Bitbucket usernames
export async function autoMapBitbucketUsernames(): Promise<{ mapped: Array<{ memberId: string; memberName: string; bitbucketUsername: string }>; total: number }> {
  return fetchApi('/bitbucket/team/auto-map', { method: 'POST' });
}

// Map team member to Bitbucket username
export async function mapTeamMemberToBitbucket(
  memberId: string,
  bitbucketUsername: string
): Promise<TeamMember> {
  return fetchApi<TeamMember>(`/bitbucket/team/${memberId}/bitbucket`, {
    method: 'PUT',
    body: JSON.stringify({ bitbucketUsername }),
  });
}

// Get Bitbucket repos
export async function getBitbucketRepos(activeOnly = false): Promise<BitbucketRepo[]> {
  const params = activeOnly ? '?active=true' : '';
  return fetchApi<BitbucketRepo[]>(`/bitbucket/repos${params}`);
}

// Discover repos from team activity
export async function discoverBitbucketRepos(): Promise<{ repos: BitbucketRepo[]; discovered: number }> {
  return fetchApi<{ repos: BitbucketRepo[]; discovered: number }>('/bitbucket/discover', {
    method: 'POST',
  });
}

// Toggle repo tracking
export async function toggleBitbucketRepo(slug: string, isActive: boolean): Promise<BitbucketRepo> {
  return fetchApi<BitbucketRepo>(`/bitbucket/repos/${slug}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });
}

// Trigger Bitbucket sync
export async function triggerBitbucketSync(): Promise<{
  success: boolean;
  prsProcessed: number;
  commitsProcessed: number;
  pipelinesProcessed: number;
  xpAwarded: number;
  error?: string;
}> {
  return fetchApi('/bitbucket/sync', {
    method: 'POST',
  });
}

// Get Bitbucket sync status
export async function getBitbucketSyncStatus(): Promise<{
  isRunning: boolean;
  syncState: BitbucketSyncState;
  hasTimer: boolean;
}> {
  return fetchApi('/bitbucket/sync/status');
}

// Update Bitbucket sync config
export async function updateBitbucketSyncConfig(input: UpdateBitbucketSyncConfigInput): Promise<BitbucketSyncState> {
  return fetchApi<BitbucketSyncState>('/bitbucket/sync/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Get PRs
export async function getBitbucketPRs(options?: {
  repo?: string;
  state?: 'OPEN' | 'MERGED' | 'DECLINED';
  author?: string;
  memberId?: string;
  limit?: number;
}): Promise<BitbucketPullRequest[]> {
  const params = new URLSearchParams();
  if (options?.repo) params.set('repo', options.repo);
  if (options?.state) params.set('state', options.state);
  if (options?.author) params.set('author', options.author);
  if (options?.memberId) params.set('memberId', options.memberId);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return fetchApi<BitbucketPullRequest[]>(`/bitbucket/prs${query ? `?${query}` : ''}`);
}

// Get commits
export async function getBitbucketCommits(options?: {
  repo?: string;
  author?: string;
  memberId?: string;
  since?: string;
  limit?: number;
}): Promise<BitbucketCommit[]> {
  const params = new URLSearchParams();
  if (options?.repo) params.set('repo', options.repo);
  if (options?.author) params.set('author', options.author);
  if (options?.memberId) params.set('memberId', options.memberId);
  if (options?.since) params.set('since', options.since);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return fetchApi<BitbucketCommit[]>(`/bitbucket/commits${query ? `?${query}` : ''}`);
}

// Get pipelines
export async function getBitbucketPipelines(options?: {
  repo?: string;
  state?: string;
  since?: string;
  limit?: number;
}): Promise<BitbucketPipeline[]> {
  const params = new URLSearchParams();
  if (options?.repo) params.set('repo', options.repo);
  if (options?.state) params.set('state', options.state);
  if (options?.since) params.set('since', options.since);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return fetchApi<BitbucketPipeline[]>(`/bitbucket/pipelines${query ? `?${query}` : ''}`);
}

// Get activity feed
export async function getBitbucketActivity(limit = 50): Promise<BitbucketActivityItem[]> {
  return fetchApi<BitbucketActivityItem[]>(`/bitbucket/activity?limit=${limit}`);
}

// Get engineer metrics
export async function getBitbucketMetrics(): Promise<BitbucketEngineerMetrics[]> {
  return fetchApi<BitbucketEngineerMetrics[]>('/bitbucket/metrics');
}

// Get Bitbucket leaderboard
export async function getBitbucketLeaderboard(): Promise<BitbucketLeaderboardEntry[]> {
  return fetchApi<BitbucketLeaderboardEntry[]>('/bitbucket/leaderboard');
}

// ============================================================================
// Automation Engine API
// ============================================================================

// Get automation config
export async function getAutomationConfig(): Promise<AutomationConfig> {
  return fetchApi<AutomationConfig>('/automation/config');
}

// Update automation config
export async function updateAutomationConfig(input: UpdateAutomationConfigInput): Promise<AutomationConfig> {
  return fetchApi<AutomationConfig>('/automation/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Trigger an automation run
export async function triggerAutomationRun(): Promise<AutomationRun> {
  return fetchApi<AutomationRun>('/automation/run', {
    method: 'POST',
  });
}

// Get automation run history
export async function getAutomationRuns(limit = 20): Promise<AutomationRun[]> {
  return fetchApi<AutomationRun[]>(`/automation/runs?limit=${limit}`);
}

// Get automation actions with optional filters
export async function getAutomationActions(filters?: { status?: string; type?: string }): Promise<AutomationAction[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const query = params.toString();
  return fetchApi<AutomationAction[]>(`/automation/actions${query ? `?${query}` : ''}`);
}

// Approve an automation action
export async function approveAutomationAction(id: string): Promise<AutomationAction> {
  return fetchApi<AutomationAction>(`/automation/actions/${id}/approve`, {
    method: 'POST',
  });
}

// Reject an automation action
export async function rejectAutomationAction(id: string): Promise<AutomationAction> {
  return fetchApi<AutomationAction>(`/automation/actions/${id}/reject`, {
    method: 'POST',
  });
}

// ============================================================================
// Meetings API
// ============================================================================

// Process meeting notes with AI
export async function processMeetingNotes(input: CreateMeetingInput): Promise<MeetingProcessResult> {
  return fetchApi<MeetingProcessResult>('/meetings/process', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Get all meetings
export async function getMeetings(): Promise<Meeting[]> {
  return fetchApi<Meeting[]>('/meetings');
}

// Get a single meeting with full details
export async function getMeeting(id: string): Promise<MeetingFull> {
  return fetchApi<MeetingFull>(`/meetings/${id}`);
}

// Update a meeting action item status
export async function updateMeetingActionItem(
  _meetingId: string,
  actionItemId: string,
  status: MeetingActionItemStatus
): Promise<MeetingActionItem> {
  return fetchApi<MeetingActionItem>(`/meetings/action-items/${actionItemId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// Convert an action item to a ticket
export async function convertActionItemToTicket(
  _meetingId: string,
  actionItemId: string
): Promise<{ ticketId: string }> {
  const ticket = await fetchApi<{ id: string }>(`/meetings/action-items/${actionItemId}/convert-to-ticket`, {
    method: 'POST',
  });
  return { ticketId: ticket.id };
}

// ============================================================================
// Reports API
// ============================================================================

// Get all reports
export async function getReports(): Promise<Report[]> {
  return fetchApi<Report[]>('/reports');
}

// Get a single report
export async function getReport(id: string): Promise<Report> {
  return fetchApi<Report>(`/reports/${id}`);
}

// Generate a new report
export async function generateReport(input: GenerateReportInput): Promise<Report> {
  return fetchApi<Report>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Delete a report
export async function deleteReport(id: string): Promise<void> {
  await fetchApi<{ deleted: true }>(`/reports/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Slack API
// ============================================================================

// Get Slack config
export async function getSlackConfig(): Promise<{ config: SlackConfig | null }> {
  return fetchApi<{ config: SlackConfig | null }>('/slack/config');
}

// Update Slack config
export async function updateSlackConfig(input: UpdateSlackConfigInput): Promise<SlackConfig> {
  return fetchApi<SlackConfig>('/slack/config', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Test Slack connection
export async function testSlackConnection(): Promise<SlackTestConnectionResponse> {
  return fetchApi<SlackTestConnectionResponse>('/slack/test', {
    method: 'POST',
  });
}

// Get Slack channels
export async function getSlackChannels(): Promise<SlackChannel[]> {
  return fetchApi<SlackChannel[]>('/slack/channels');
}

// Toggle channel monitoring
export async function toggleSlackChannel(channelId: string, isMonitored: boolean): Promise<SlackChannel> {
  return fetchApi<SlackChannel>(`/slack/channels/${channelId}`, {
    method: 'PUT',
    body: JSON.stringify({ isMonitored }),
  });
}

// Get Slack insights
export async function getSlackInsights(limit = 50): Promise<SlackInsight[]> {
  return fetchApi<SlackInsight[]>(`/slack/insights?limit=${limit}`);
}

// Trigger Slack sync
export async function triggerSlackSync(): Promise<SlackSyncState> {
  return fetchApi<SlackSyncState>('/slack/sync', {
    method: 'POST',
  });
}

// Get Slack sync status
export async function getSlackSyncStatus(): Promise<SlackSyncState> {
  return fetchApi<SlackSyncState>('/slack/sync/status');
}

// Get Slack user mappings
export async function getSlackUserMappings(): Promise<SlackUserMapping[]> {
  return fetchApi<SlackUserMapping[]>('/slack/user-mappings');
}

// Update Slack user mapping
export async function updateSlackUserMapping(
  slackUserId: string,
  teamMemberId: string | null
): Promise<SlackUserMapping> {
  return fetchApi<SlackUserMapping>(`/slack/user-mappings/${slackUserId}`, {
    method: 'PUT',
    body: JSON.stringify({ teamMemberId }),
  });
}
