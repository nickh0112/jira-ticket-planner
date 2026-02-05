import type { StorageService } from './storageService.js';
import type { AgentService } from './agentService.js';
import {
  brainstormIdea,
  generatePRDFromConversation,
  updatePRDFromChat,
  splitPRDIntoTickets,
  updateTicketsFromChat,
  type BrainstormContext,
} from './claudeService.js';
import type {
  IdeaSession,
  IdeaSessionFull,
  IdeaMessage,
  IdeaPRD,
  IdeaTicketProposal,
  CreateIdeaSessionInput,
  UpdateIdeaSessionInput,
  UpdateIdeaPRDInput,
  SendMessageResponse,
  GeneratePRDResponse,
  GenerateTicketsResponse,
  ApproveProposalsResponse,
  UpdateTicketProposalInput,
  CreateTicketInput,
} from '@jira-planner/shared';

interface IdeasServiceDeps {
  storage: StorageService;
  agentService?: AgentService;
}

class IdeasService {
  private storage: StorageService;
  private agentService?: AgentService;

  constructor({ storage, agentService }: IdeasServiceDeps) {
    this.storage = storage;
    this.agentService = agentService;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  createSession(input: CreateIdeaSessionInput): IdeaSession {
    return this.storage.createIdeaSession(input);
  }

  getSession(id: string): IdeaSession | null {
    return this.storage.getIdeaSession(id);
  }

  getSessionFull(id: string): IdeaSessionFull | null {
    return this.storage.getIdeaSessionFull(id);
  }

  getSessions(filters?: { status?: string }): IdeaSession[] {
    return this.storage.getIdeaSessions(filters);
  }

  updateSession(id: string, input: UpdateIdeaSessionInput): IdeaSession | null {
    return this.storage.updateIdeaSession(id, input);
  }

  archiveSession(id: string): IdeaSession | null {
    return this.storage.updateIdeaSession(id, { status: 'archived' });
  }

  deleteSession(id: string): boolean {
    return this.storage.deleteIdeaSession(id);
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  async sendMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
    const session = this.storage.getIdeaSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Create user message
    const userMessage = this.storage.createIdeaMessage({
      sessionId,
      role: 'user',
      content,
    });

    // Get conversation history including the new message
    const messages = this.storage.getIdeaMessages(sessionId);
    const currentPRD = this.storage.getIdeaPRDBySession(sessionId);
    const proposals = this.storage.getIdeaTicketProposals(sessionId, 'proposed');

    // Check if this is a PRD update request (when PRD exists)
    let prdUpdated = false;
    let ticketsUpdated = false;
    let assistantContent: string;
    let thinkingSteps: string[] | undefined;

    if (currentPRD && this.isPRDUpdateRequest(content)) {
      // Handle PRD update
      const updateResult = await updatePRDFromChat(currentPRD, content);

      // Apply updates to PRD
      if (Object.keys(updateResult.prd).length > 0) {
        this.storage.updateIdeaPRD(currentPRD.id, updateResult.prd);
        prdUpdated = true;
      }

      assistantContent = `I've updated the Blueprint. ${updateResult.changeSummary}`;
    } else if (proposals.length > 0 && this.isTicketUpdateRequest(content)) {
      // Handle ticket update
      const updateResult = await updateTicketsFromChat(proposals, content);

      // Apply updates to proposals
      for (const update of updateResult.updates) {
        this.storage.updateIdeaTicketProposal(update.proposalId, update.changes);
      }

      if (updateResult.updates.length > 0) {
        ticketsUpdated = true;
      }

      assistantContent = `I've updated the Quest proposals. ${updateResult.changeSummary}`;
    } else {
      // Regular brainstorming - build context for AI
      const brainstormContext: BrainstormContext = {
        projectContext: this.storage.getProjectContext(),
        teamMembers: this.storage.getTeamMembers(),
        epics: this.storage.getEpics(),
        recentTickets: this.storage.getTickets().slice(0, 15),
      };

      const response = await brainstormIdea(messages, currentPRD, brainstormContext);
      assistantContent = response.message;
      thinkingSteps = response.thinkingSteps;

      // If AI suggests generating PRD, append hint
      if (response.suggestPRD && !currentPRD) {
        assistantContent += '\n\n*Your idea seems well-defined! When you\'re ready, click "Generate Blueprint" to create a PRD.*';
      }
    }

    // Create assistant message
    const assistantMessage = this.storage.createIdeaMessage({
      sessionId,
      role: 'assistant',
      content: assistantContent,
    });

    return {
      userMessage,
      assistantMessage,
      thinkingSteps,
      prdUpdated,
      ticketsUpdated,
    };
  }

  private isPRDUpdateRequest(content: string): boolean {
    const prdKeywords = [
      'add a user story',
      'change the goal',
      'update the requirement',
      'modify the scope',
      'add requirement',
      'remove requirement',
      'change metric',
      'update prd',
      'update blueprint',
      'modify prd',
      'add to scope',
      'remove from scope',
    ];
    const lower = content.toLowerCase();
    return prdKeywords.some(kw => lower.includes(kw));
  }

  private isTicketUpdateRequest(content: string): boolean {
    const ticketKeywords = [
      'change ticket',
      'update ticket',
      'modify ticket',
      'change priority',
      'change the priority',
      'reassign',
      'change assignee',
      'update quest',
      'change quest',
    ];
    const lower = content.toLowerCase();
    return ticketKeywords.some(kw => lower.includes(kw));
  }

  // ============================================================================
  // PRD Generation
  // ============================================================================

  async generatePRD(sessionId: string): Promise<GeneratePRDResponse> {
    const session = this.storage.getIdeaSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if PRD already exists
    const existingPRD = this.storage.getIdeaPRDBySession(sessionId);
    if (existingPRD) {
      throw new Error('PRD already exists for this session. Use chat to modify it.');
    }

    const messages = this.storage.getIdeaMessages(sessionId);
    if (messages.length < 2) {
      throw new Error('Need more conversation to generate a PRD. Keep brainstorming!');
    }

    // Generate PRD from conversation
    const result = await generatePRDFromConversation(messages, session.title);

    // Create PRD in database
    const prd = this.storage.createIdeaPRD({
      ...result.prd,
      sessionId,
    });

    // Create assistant message about PRD generation
    const message = this.storage.createIdeaMessage({
      sessionId,
      role: 'assistant',
      content: `I've generated a Blueprint (PRD) for "${prd.title}". ${result.summary}\n\nYou can review it in the panel on the right. Feel free to ask me to make changes, or click "Generate Quests" when you're ready to create tickets.`,
    });

    return { prd, message };
  }

  updatePRD(sessionId: string, updates: UpdateIdeaPRDInput): IdeaPRD | null {
    const prd = this.storage.getIdeaPRDBySession(sessionId);
    if (!prd) {
      return null;
    }
    return this.storage.updateIdeaPRD(prd.id, updates);
  }

  // ============================================================================
  // Ticket Generation
  // ============================================================================

  async generateTickets(sessionId: string): Promise<GenerateTicketsResponse> {
    const session = this.storage.getIdeaSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const prd = this.storage.getIdeaPRDBySession(sessionId);
    if (!prd) {
      throw new Error('No PRD found. Generate a Blueprint first.');
    }

    // Get team and epic data for assignee suggestions
    const teamMembers = this.storage.getTeamMembers();
    const epics = this.storage.getEpics();
    const inferredSkills = this.storage.getInferredSkills();

    // Split PRD into tickets
    const result = await splitPRDIntoTickets(prd, teamMembers, epics, inferredSkills);

    // Create proposal records
    const proposals = this.storage.createIdeaTicketProposals(
      result.proposals.map(p => ({
        ...p,
        sessionId,
        prdId: prd.id,
      }))
    );

    // Create assistant message
    const message = this.storage.createIdeaMessage({
      sessionId,
      role: 'assistant',
      content: `I've created ${proposals.length} Quest proposals from your Blueprint. ${result.summary}\n\nReview them in the panel on the right. You can approve, reject, or ask me to modify them. When ready, click "Create Approved Quests" to add them to your backlog.`,
    });

    return { proposals, message };
  }

  // ============================================================================
  // Ticket Proposal Management
  // ============================================================================

  getProposals(sessionId: string, status?: string): IdeaTicketProposal[] {
    return this.storage.getIdeaTicketProposals(sessionId, status as any);
  }

  updateProposal(proposalId: string, updates: UpdateTicketProposalInput): IdeaTicketProposal | null {
    return this.storage.updateIdeaTicketProposal(proposalId, updates);
  }

  rejectProposal(proposalId: string): IdeaTicketProposal | null {
    return this.storage.rejectIdeaTicketProposal(proposalId);
  }

  async approveProposals(sessionId: string, proposalIds: string[]): Promise<ApproveProposalsResponse> {
    const session = this.storage.getIdeaSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const createdTicketIds: string[] = [];

    for (const proposalId of proposalIds) {
      const proposal = this.storage.getIdeaTicketProposal(proposalId);
      if (!proposal || proposal.sessionId !== sessionId) {
        continue;
      }

      // Create actual ticket from proposal
      const ticketInput: CreateTicketInput = {
        title: proposal.title,
        description: proposal.description,
        acceptanceCriteria: proposal.acceptanceCriteria,
        ticketType: proposal.ticketType as any,
        priority: proposal.priority as any,
        epicId: proposal.suggestedEpicId ?? undefined,
        assigneeId: proposal.suggestedAssigneeId ?? undefined,
        labels: [proposal.layer],
        requiredSkills: proposal.requiredSkills,
        featureGroupId: proposal.featureGroupId ?? undefined,
      };

      const ticket = this.storage.createTicket(ticketInput);
      createdTicketIds.push(ticket.id);

      // Update proposal status
      this.storage.approveIdeaTicketProposal(proposalId, ticket.id);
    }

    // Update session status if all proposals are processed
    const remainingProposals = this.storage.getIdeaTicketProposals(sessionId, 'proposed');
    if (remainingProposals.length === 0) {
      this.storage.updateIdeaSession(sessionId, { status: 'tickets_created' });
    }

    return {
      approvedCount: createdTicketIds.length,
      createdTicketIds,
    };
  }
}

export const createIdeasService = (deps: IdeasServiceDeps) => new IdeasService(deps);
export type { IdeasService };
