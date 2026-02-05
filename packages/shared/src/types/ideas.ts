// ============================================================================
// Ideas Feature Types
// ============================================================================

// Session status
export type IdeaSessionStatus = 'brainstorming' | 'prd_generated' | 'tickets_created' | 'archived';

// Ticket proposal status
export type TicketProposalStatus = 'proposed' | 'approved' | 'rejected' | 'created';

// Work layer for tickets
export type WorkLayer = 'frontend' | 'backend' | 'design' | 'fullstack' | 'infrastructure' | 'data';

// Message role
export type IdeaMessageRole = 'user' | 'assistant';

// ============================================================================
// Idea Session
// ============================================================================

export interface IdeaSession {
  id: string;
  title: string;
  summary: string | null;
  status: IdeaSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaSessionInput {
  title: string;
  initialMessage?: string;
}

export interface UpdateIdeaSessionInput {
  title?: string;
  summary?: string;
  status?: IdeaSessionStatus;
}

// ============================================================================
// Idea Messages
// ============================================================================

export interface IdeaMessage {
  id: string;
  sessionId: string;
  role: IdeaMessageRole;
  content: string;
  createdAt: string;
}

export interface CreateIdeaMessageInput {
  sessionId: string;
  role: IdeaMessageRole;
  content: string;
}

// ============================================================================
// PRD (Product Requirements Document)
// ============================================================================

export interface PRDScopeBoundaries {
  inScope: string[];
  outOfScope: string[];
}

export interface IdeaPRD {
  id: string;
  sessionId: string;
  title: string;
  problemStatement: string;
  goals: string[];
  userStories: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string;
  successMetrics: string;
  scopeBoundaries: PRDScopeBoundaries;
  technicalConsiderations: string | null;
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaPRDInput {
  sessionId: string;
  title: string;
  problemStatement: string;
  goals: string[];
  userStories: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string;
  successMetrics: string;
  scopeBoundaries: PRDScopeBoundaries;
  technicalConsiderations?: string;
  rawContent: string;
}

export interface UpdateIdeaPRDInput {
  title?: string;
  problemStatement?: string;
  goals?: string[];
  userStories?: string[];
  functionalRequirements?: string[];
  nonFunctionalRequirements?: string;
  successMetrics?: string;
  scopeBoundaries?: PRDScopeBoundaries;
  technicalConsiderations?: string;
  rawContent?: string;
}

// ============================================================================
// Ticket Proposals
// ============================================================================

export interface IdeaTicketProposal {
  id: string;
  sessionId: string;
  prdId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  ticketType: string;
  priority: string;
  layer: WorkLayer;
  requiredSkills: string[];
  suggestedAssigneeId: string | null;
  suggestedEpicId: string | null;
  assignmentConfidence: number;
  assignmentReasoning: string | null;
  status: TicketProposalStatus;
  createdTicketId: string | null;
  featureGroupId: string | null;
  createdAt: string;
}

export interface CreateTicketProposalInput {
  sessionId: string;
  prdId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  ticketType: string;
  priority: string;
  layer: WorkLayer;
  requiredSkills?: string[];
  suggestedAssigneeId?: string;
  suggestedEpicId?: string;
  assignmentConfidence?: number;
  assignmentReasoning?: string;
  featureGroupId?: string;
}

export interface UpdateTicketProposalInput {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  ticketType?: string;
  priority?: string;
  layer?: WorkLayer;
  requiredSkills?: string[];
  suggestedAssigneeId?: string | null;
  suggestedEpicId?: string | null;
  assignmentConfidence?: number;
  assignmentReasoning?: string | null;
  status?: TicketProposalStatus;
  createdTicketId?: string;
}

// ============================================================================
// Full Session Data (with all relations)
// ============================================================================

export interface IdeaSessionFull {
  session: IdeaSession;
  messages: IdeaMessage[];
  prd: IdeaPRD | null;
  proposals: IdeaTicketProposal[];
}

// ============================================================================
// AI Response Types
// ============================================================================

export interface BrainstormResponse {
  message: string;
  thinkingSteps?: string[];
  suggestPRD?: boolean;
}

export interface PRDGenerationResponse {
  prd: CreateIdeaPRDInput;
  summary: string;
}

export interface PRDUpdateResponse {
  prd: UpdateIdeaPRDInput;
  changeSummary: string;
}

export interface TicketSplitResponse {
  proposals: Omit<CreateTicketProposalInput, 'sessionId' | 'prdId'>[];
  summary: string;
}

export interface TicketUpdateResponse {
  updates: { proposalId: string; changes: UpdateTicketProposalInput }[];
  changeSummary: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface IdeasListResponse {
  sessions: IdeaSession[];
  total: number;
}

export interface SendMessageResponse {
  userMessage: IdeaMessage;
  assistantMessage: IdeaMessage;
  thinkingSteps?: string[];
  prdUpdated?: boolean;
  ticketsUpdated?: boolean;
}

export interface GeneratePRDResponse {
  prd: IdeaPRD;
  message: IdeaMessage;
}

export interface GenerateTicketsResponse {
  proposals: IdeaTicketProposal[];
  message: IdeaMessage;
}

export interface ApproveProposalsResponse {
  approvedCount: number;
  createdTicketIds: string[];
}
