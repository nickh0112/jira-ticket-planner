import type { Ticket } from './ticket.js';

// Agent options for controlling behavior
export interface AgentOptions {
  autoEnhance?: boolean;
  autoRoute?: boolean;
  createMissingEpics?: boolean;
  qualityThreshold?: 'basic' | 'standard' | 'comprehensive';
}

// Quality thresholds
export const qualityMetrics = {
  basic: {
    minDescriptionLength: 50,
    minAcceptanceCriteria: 1,
  },
  standard: {
    minDescriptionLength: 150,
    minAcceptanceCriteria: 3,
    requireEpic: true,
  },
  comprehensive: {
    minDescriptionLength: 300,
    minAcceptanceCriteria: 5,
    requireSuccessMetrics: true,
    requireTechnicalContext: true,
    requireAIAgentNotes: true,
  },
};

// Ticket enhancements added by the agent
export interface TicketEnhancements {
  originalDescription: string;
  enhancedDescription: string;
  addedAcceptanceCriteria: string[];
  successMetrics: string[];
  technicalContext: string;
  aiCodingNotes?: string;
}

// Epic suggestion from the agent
export interface EpicSuggestion {
  type: 'match' | 'create';
  epicId?: string;
  confidence: number;
  reasoning: string;
  newEpicProposal?: {
    name: string;
    key: string;
    description: string;
  };
}

// Assignee suggestion from the agent
export interface AssigneeSuggestion {
  teamMemberId: string;
  confidence: number;
  reasoning: string;
  matchedSkills: string[];
}

// Suggestions for a ticket
export interface TicketSuggestions {
  epicSuggestion: EpicSuggestion;
  assigneeSuggestions: AssigneeSuggestion[];
}

// Enhanced ticket with agent additions
export interface EnhancedTicket extends Ticket {
  enhancements?: TicketEnhancements;
  suggestions?: TicketSuggestions;
}

// Agent knowledge types
export type KnowledgeType =
  | 'ticket_pattern'
  | 'epic_category'
  | 'skill_inference'
  | 'field_pattern'
  | 'assignment_pattern';

// Stored agent knowledge
export interface AgentKnowledge {
  id: string;
  knowledgeType: KnowledgeType;
  key: string;
  value: string;
  confidence: number;
  lastUpdated: string;
}

// Inferred team member skills
export interface InferredSkill {
  id: string;
  teamMemberId: string;
  skill: string;
  confidence: number;
  evidence: string;
  lastUpdated: string;
}

// Epic category for better matching
export interface EpicCategory {
  id: string;
  epicId: string;
  category: string;
  keywords: string[];
  lastUpdated: string;
}

// Learning result from Jira analysis
export interface LearningResult {
  ticketsAnalyzed: number;
  patternsLearned: number;
  skillsInferred: { teamMemberId: string; skills: string[] }[];
  epicCategories: { epicId: string; categories: string[] }[];
}

// Enhancement request
export interface EnhanceTicketRequest {
  ticketId: string;
  qualityThreshold?: 'basic' | 'standard' | 'comprehensive';
}

// Enhancement response
export interface EnhanceTicketResponse {
  ticket: EnhancedTicket;
  meetsQualityThreshold: boolean;
  qualityScore: number;
}

// Epic suggestion request
export interface SuggestEpicRequest {
  title: string;
  description: string;
  ticketType: string;
}

// Assignee suggestion request
export interface SuggestAssigneeRequest {
  title: string;
  description: string;
  ticketType: string;
  requiredSkills?: string[];
}

// Process transcript with agent options
export interface ProcessTranscriptRequest {
  transcript: string;
  options?: AgentOptions;
}

// Process transcript response with enhanced tickets
export interface ProcessTranscriptResponse {
  tickets: EnhancedTicket[];
  pendingEpicProposals: EpicSuggestion[];
}

// Agent knowledge response
export interface AgentKnowledgeResponse {
  knowledge: AgentKnowledge[];
  inferredSkills: InferredSkill[];
  epicCategories: EpicCategory[];
}
