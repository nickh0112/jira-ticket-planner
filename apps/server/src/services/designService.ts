import type { StorageService } from './storageService.js';
import type { JiraService } from './jiraService.js';
import {
  designConversation,
  generateDesignPrototype,
} from './claudeService.js';
import type {
  DesignSession,
  DesignSessionFull,
  CreateDesignSessionInput,
  UpdateDesignSessionInput,
  DesignSendMessageResponse,
  GeneratePrototypeResponse,
  ShareDesignResponse,
} from '@jira-planner/shared';

interface DesignServiceDeps {
  storage: StorageService;
  jiraService?: JiraService | null;
}

class DesignService {
  private storage: StorageService;
  private jiraService: JiraService | null;

  constructor({ storage, jiraService }: DesignServiceDeps) {
    this.storage = storage;
    this.jiraService = jiraService ?? null;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  createSession(input: CreateDesignSessionInput): DesignSession {
    return this.storage.createDesignSession(input);
  }

  getSession(id: string): DesignSession | null {
    return this.storage.getDesignSession(id);
  }

  getSessionFull(id: string): DesignSessionFull | null {
    return this.storage.getDesignSessionFull(id);
  }

  getSessions(filters?: { status?: string }): DesignSession[] {
    return this.storage.getDesignSessions(filters);
  }

  updateSession(id: string, input: UpdateDesignSessionInput): DesignSession | null {
    return this.storage.updateDesignSession(id, input);
  }

  archiveSession(id: string): DesignSession | null {
    return this.storage.deleteDesignSession(id) ? null : null;
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  async sendMessage(sessionId: string, content: string): Promise<DesignSendMessageResponse> {
    const session = this.storage.getDesignSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Create user message
    const userMessage = this.storage.createDesignMessage({
      sessionId,
      role: 'user',
      content,
    });

    // Load context
    const messages = this.storage.getDesignMessages(sessionId);
    const latestPrototype = this.storage.getLatestDesignPrototype(sessionId);

    // Build source details
    const sourceDetails = this.getSourceDetails(session.sourceType, session.sourceId);
    const codebaseContext = this.getCodebaseContextSummary(session.codebaseContextId);

    // Call Claude
    const response = await designConversation(messages, {
      currentPrototype: latestPrototype?.componentCode,
      sourceDetails,
      codebaseContext,
    });

    // Auto-extract tsx/jsx code blocks from response
    let newPrototype = undefined;
    const codeBlock = this.extractCodeBlock(response.message);
    if (codeBlock) {
      newPrototype = this.storage.createDesignPrototype({
        sessionId,
        name: session.title,
        description: 'Auto-extracted from conversation',
        componentCode: codeBlock,
      });
    }

    // Create assistant message
    const assistantMessage = this.storage.createDesignMessage({
      sessionId,
      role: 'assistant',
      content: response.message,
    });

    return {
      userMessage,
      assistantMessage,
      newPrototype,
    };
  }

  // ============================================================================
  // Prototype Generation
  // ============================================================================

  async generatePrototype(sessionId: string): Promise<GeneratePrototypeResponse> {
    const session = this.storage.getDesignSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const messages = this.storage.getDesignMessages(sessionId);
    const sourceDetails = this.getSourceDetails(session.sourceType, session.sourceId);
    const codebaseContext = this.getCodebaseContextSummary(session.codebaseContextId);

    // Build conversation summary from messages
    const conversationSummary = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const result = await generateDesignPrototype({
      sessionTitle: session.title,
      conversationSummary,
      sourceDetails,
      codebaseContext,
    });

    // Store prototype
    const prototype = this.storage.createDesignPrototype({
      sessionId,
      name: result.name,
      description: result.description,
      componentCode: result.componentCode,
    });

    // Create assistant message
    const message = this.storage.createDesignMessage({
      sessionId,
      role: 'assistant',
      content: `I've generated a prototype component: **${result.name}**\n\n${result.description}\n\nYou can preview it in the panel on the right.`,
    });

    return { prototype, message };
  }

  // ============================================================================
  // Approve & Share
  // ============================================================================

  approvePrototype(sessionId: string): DesignSession | null {
    return this.storage.updateDesignSession(sessionId, { status: 'approved' });
  }

  async sharePrototype(sessionId: string, options: { method: 'code' | 'jira' }): Promise<ShareDesignResponse> {
    const session = this.storage.getDesignSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const latestPrototype = this.storage.getLatestDesignPrototype(sessionId);
    if (!latestPrototype) {
      throw new Error('No prototype found to share');
    }

    if (options.method === 'code') {
      this.storage.updateDesignSession(sessionId, { status: 'shared' });
      return {
        method: 'code',
        code: latestPrototype.componentCode,
      };
    }

    // Jira sharing
    if (!session.sourceId) {
      throw new Error('No source ticket linked to this session');
    }

    if (!this.jiraService) {
      throw new Error('Jira service not configured');
    }

    // Look up the ticket to get the jiraKey
    const ticket = this.storage.getTicket(session.sourceId);
    if (!ticket?.jiraKey) {
      throw new Error('Source ticket has no Jira key');
    }

    const jiraConfig = this.storage.getJiraConfig();
    if (!jiraConfig) {
      throw new Error('Jira not configured');
    }

    const commentBody = `## Design Prototype: ${latestPrototype.name}\n\n${latestPrototype.description}\n\n\`\`\`tsx\n${latestPrototype.componentCode}\n\`\`\``;

    const comment = await this.jiraService.addComment(jiraConfig, ticket.jiraKey, commentBody);
    this.storage.updateDesignSession(sessionId, { status: 'shared' });

    const jiraCommentUrl = `${jiraConfig.baseUrl}/browse/${ticket.jiraKey}?focusedCommentId=${comment.id}`;

    return {
      method: 'jira',
      jiraCommentUrl,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getSourceDetails(sourceType: string, sourceId: string | null): string | undefined {
    if (!sourceId) return undefined;

    try {
      if (sourceType === 'ticket') {
        const ticket = this.storage.getTicket(sourceId);
        if (ticket) {
          return `Ticket: ${ticket.title}\nDescription: ${ticket.description}\nType: ${ticket.ticketType}\nPriority: ${ticket.priority}\nAcceptance Criteria: ${ticket.acceptanceCriteria.join('; ')}`;
        }
      } else if (sourceType === 'prd') {
        const prd = this.storage.getIdeaPRDBySession(sourceId);
        if (prd) {
          return `PRD: ${prd.title}\nProblem: ${prd.problemStatement}\nGoals: ${prd.goals.join('; ')}\nUser Stories: ${prd.userStories.join('; ')}\nRequirements: ${prd.functionalRequirements.join('; ')}`;
        }
      }
    } catch {
      // Source not found, continue without context
    }

    return undefined;
  }

  private getCodebaseContextSummary(codebaseContextId: string | null): string | undefined {
    if (!codebaseContextId) return undefined;

    try {
      const ctx = this.storage.getCodebaseContext(codebaseContextId);
      if (ctx) {
        return ctx.contextSummary;
      }
    } catch {
      // Context not found
    }

    return undefined;
  }

  private extractCodeBlock(content: string): string | null {
    const regex = /```(?:tsx|jsx)\s*\n([\s\S]*?)```/;
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }
}

export const createDesignService = (deps: DesignServiceDeps) => new DesignService(deps);
export type { DesignService };
