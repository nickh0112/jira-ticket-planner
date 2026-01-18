import type { createStorageService } from './storageService.js';
import type { JiraService } from './jiraService.js';
import type {
  AgentOptions,
  EnhancedTicket,
  LearningResult,
  EpicSuggestion,
  AssigneeSuggestion,
  AgentKnowledgeResponse,
  TicketEnhancements,
  TicketSuggestions,
} from '@jira-planner/shared';
import type { Ticket, CreateTicketInput } from '@jira-planner/shared';

import {
  learnFromJiraHistory,
  enhanceTicket,
  validateQuality,
  suggestEpic,
  suggestAssignees,
} from './agent/index.js';

export interface AgentContext {
  storage: ReturnType<typeof createStorageService>;
  jiraService: JiraService | null;
}

export class AgentService {
  private storage: ReturnType<typeof createStorageService>;
  private jiraService: JiraService | null;

  constructor(context: AgentContext) {
    this.storage = context.storage;
    this.jiraService = context.jiraService;
  }

  /**
   * Learn from Jira ticket history to build knowledge base
   * Analyzes assignment patterns, ticket quality patterns, and epic taxonomy
   */
  async learnFromJira(): Promise<LearningResult> {
    const config = this.storage.getJiraConfig();
    if (!config || !this.jiraService) {
      throw new Error('Jira configuration not available');
    }

    return learnFromJiraHistory({
      storage: this.storage,
      jiraService: this.jiraService,
      config,
    });
  }

  /**
   * Get the current agent knowledge base
   */
  getKnowledge(): AgentKnowledgeResponse {
    return {
      knowledge: this.storage.getAgentKnowledge(),
      inferredSkills: this.storage.getInferredSkills(),
      epicCategories: this.storage.getEpicCategories(),
    };
  }

  /**
   * Enhance a single ticket with detailed technical context
   */
  async enhanceTicket(
    ticketId: string,
    qualityThreshold: 'basic' | 'standard' | 'comprehensive' = 'comprehensive'
  ): Promise<{ ticket: EnhancedTicket; meetsQualityThreshold: boolean; qualityScore: number }> {
    const ticket = this.storage.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const teamMembers = this.storage.getTeamMembers();
    const epics = this.storage.getEpics();
    const inferredSkills = this.storage.getInferredSkills();

    const enhancements = await enhanceTicket(ticket, {
      teamMembers,
      epics,
      inferredSkills,
      qualityThreshold,
    });

    // Save enhancements
    this.storage.saveTicketEnhancements(ticketId, enhancements);

    // Validate quality
    const { meetsThreshold, score } = validateQuality(enhancements, qualityThreshold);

    const enhancedTicket: EnhancedTicket = {
      ...ticket,
      enhancements,
    };

    return {
      ticket: enhancedTicket,
      meetsQualityThreshold: meetsThreshold,
      qualityScore: score,
    };
  }

  /**
   * Get epic suggestion for a ticket
   */
  async suggestEpicForTicket(ticket: {
    title: string;
    description: string;
    ticketType: string;
  }): Promise<EpicSuggestion> {
    const epics = this.storage.getEpics();
    const epicCategories = this.storage.getEpicCategories();

    return suggestEpic(ticket, { epics, epicCategories });
  }

  /**
   * Get assignee suggestions for a ticket
   */
  async suggestAssigneesForTicket(ticket: {
    title: string;
    description: string;
    ticketType: string;
    requiredSkills?: string[];
  }): Promise<AssigneeSuggestion[]> {
    const teamMembers = this.storage.getTeamMembers();
    const inferredSkills = this.storage.getInferredSkills();

    return suggestAssignees(ticket, { teamMembers, inferredSkills });
  }

  /**
   * Process a transcript with full agent enhancement pipeline
   * This is the main entry point that combines parsing, enhancement, and routing
   */
  async processTranscript(
    ticketInputs: CreateTicketInput[],
    options: AgentOptions = {}
  ): Promise<{ tickets: EnhancedTicket[]; pendingEpicProposals: EpicSuggestion[] }> {
    const {
      autoEnhance = true,
      autoRoute = true,
      createMissingEpics = true,
      qualityThreshold = 'comprehensive',
    } = options;

    const teamMembers = this.storage.getTeamMembers();
    const epics = this.storage.getEpics();
    const inferredSkills = this.storage.getInferredSkills();
    const epicCategories = this.storage.getEpicCategories();

    const enhancedTickets: EnhancedTicket[] = [];
    const pendingEpicProposals: EpicSuggestion[] = [];

    for (const input of ticketInputs) {
      // Create the basic ticket first
      const ticket = this.storage.createTicket(input);
      let enhancedTicket: EnhancedTicket = { ...ticket };

      // Enhancement pipeline
      if (autoEnhance) {
        const enhancements = await enhanceTicket(ticket, {
          teamMembers,
          epics,
          inferredSkills,
          qualityThreshold,
        });

        this.storage.saveTicketEnhancements(ticket.id, enhancements);
        enhancedTicket.enhancements = enhancements;
      }

      // Routing pipeline
      if (autoRoute) {
        const suggestions: TicketSuggestions = {
          epicSuggestion: await suggestEpic(
            { title: ticket.title, description: ticket.description, ticketType: ticket.ticketType },
            { epics, epicCategories }
          ),
          assigneeSuggestions: await suggestAssignees(
            { title: ticket.title, description: ticket.description, ticketType: ticket.ticketType },
            { teamMembers, inferredSkills }
          ),
        };

        enhancedTicket.suggestions = suggestions;

        // Handle epic assignment or proposal
        if (suggestions.epicSuggestion.type === 'match' && suggestions.epicSuggestion.epicId) {
          if (suggestions.epicSuggestion.confidence >= 0.7) {
            // High confidence - auto-assign
            this.storage.updateTicket(ticket.id, { epicId: suggestions.epicSuggestion.epicId });
            enhancedTicket.epicId = suggestions.epicSuggestion.epicId;
          }
        } else if (suggestions.epicSuggestion.type === 'create' && createMissingEpics) {
          // Store pending epic proposal
          if (suggestions.epicSuggestion.newEpicProposal) {
            this.storage.savePendingEpicProposal(ticket.id, suggestions.epicSuggestion);
            pendingEpicProposals.push(suggestions.epicSuggestion);
          }
        }

        // Handle assignee suggestion - auto-assign top pick if confidence is high
        if (suggestions.assigneeSuggestions.length > 0) {
          const topSuggestion = suggestions.assigneeSuggestions[0];
          if (topSuggestion.confidence >= 0.7) {
            this.storage.updateTicket(ticket.id, { assigneeId: topSuggestion.teamMemberId });
            enhancedTicket.assigneeId = topSuggestion.teamMemberId;
          }
        }
      }

      enhancedTickets.push(enhancedTicket);
    }

    return { tickets: enhancedTickets, pendingEpicProposals };
  }

  /**
   * Approve a pending epic proposal - creates the epic and links the ticket
   */
  async approveEpicProposal(proposalId: string): Promise<{ epicId: string }> {
    const proposal = this.storage.getPendingEpicProposal(proposalId);
    if (!proposal) {
      throw new Error(`Epic proposal not found: ${proposalId}`);
    }

    // Create the epic
    const epic = this.storage.createEpic({
      name: proposal.proposedName,
      key: proposal.proposedKey,
      description: proposal.proposedDescription,
    });

    // Link the ticket to the new epic
    this.storage.updateTicket(proposal.ticketId, { epicId: epic.id });

    // Mark proposal as approved
    this.storage.updatePendingEpicProposal(proposalId, { status: 'approved' });

    return { epicId: epic.id };
  }

  /**
   * Reject a pending epic proposal
   */
  rejectEpicProposal(proposalId: string): void {
    this.storage.updatePendingEpicProposal(proposalId, { status: 'rejected' });
  }
}

export const createAgentService = (context: AgentContext): AgentService => {
  return new AgentService(context);
};
