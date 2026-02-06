import { v4 as uuidv4 } from 'uuid';
import { callClaudeWithRetry } from './claudeService.js';
import type { StorageService } from './storageService.js';
import type { JiraService } from './jiraService.js';
import type {
  MeetingType,
  MeetingProcessResult,
  TeamMember,
  Epic,
} from '@jira-planner/shared';

interface ProcessMeetingInput {
  title: string;
  type: MeetingType;
  rawInput: string;
}

interface ProcessMeetingContext {
  teamMembers: TeamMember[];
  epics: Epic[];
}

export class MeetingService {
  private storage: StorageService;
  private jiraService: JiraService | null;

  constructor(storage: StorageService, jiraService?: JiraService | null) {
    this.storage = storage;
    this.jiraService = jiraService ?? null;
  }

  async processMeetingNotes(
    input: ProcessMeetingInput,
    context: ProcessMeetingContext
  ): Promise<MeetingProcessResult> {
    const { title, type, rawInput } = input;
    const { teamMembers, epics } = context;

    const teamMemberList = teamMembers
      .map(m => `- ${m.name} (id: ${m.id}, role: ${m.role})`)
      .join('\n');

    const epicList = epics
      .map(e => `- ${e.name} (key: ${e.key})`)
      .join('\n');

    const systemPrompt = `You are a meeting notes processor. Analyze the meeting notes and extract structured information.

Team members:
${teamMemberList}

Epics/Projects:
${epicList}

Return a JSON object with this structure:
{
  "summary": "Brief AI-generated summary of the meeting",
  "objectives": [
    {
      "objective": "Description of the objective",
      "ownerName": "Name of the owner (must match a team member name exactly, or null)",
      "dueDate": "YYYY-MM-DD or null"
    }
  ],
  "decisions": [
    {
      "decision": "What was decided",
      "context": "Why or additional context"
    }
  ],
  "actionItems": [
    {
      "action": "What needs to be done",
      "assigneeName": "Name of the assignee (must match a team member name exactly, or null)",
      "dueDate": "YYYY-MM-DD or null"
    }
  ],
  "ticketSuggestions": [
    {
      "title": "Suggested ticket title",
      "description": "Ticket description",
      "ticketType": "feature|bug|improvement|task",
      "priority": "highest|high|medium|low|lowest",
      "assigneeName": "Name of suggested assignee or null"
    }
  ]
}

Rules:
- Match owner/assignee names exactly to the team members list provided
- If you cannot confidently match a name, set it to null
- Only create ticket suggestions for clearly actionable items that warrant tracking
- Keep the summary concise (2-4 sentences)
- Return ONLY valid JSON, no markdown or other formatting`;

    const response = await callClaudeWithRetry({
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Meeting Type: ${type}\nTitle: ${title}\n\nMeeting Notes:\n${rawInput}`,
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(responseText);

    // Create the meeting record
    const meetingId = uuidv4();
    const meeting = this.storage.createMeeting({
      id: meetingId,
      title,
      meetingType: type,
      rawInput,
      aiSummary: parsed.summary,
    });

    // Resolve team member names to IDs
    const nameToId = new Map<string, string>();
    for (const member of teamMembers) {
      nameToId.set(member.name.toLowerCase(), member.id);
    }

    // Save objectives
    const objectives = (parsed.objectives || []).map((obj: any) => {
      const ownerId = obj.ownerName
        ? nameToId.get(obj.ownerName.toLowerCase()) ?? undefined
        : undefined;
      return this.storage.createMeetingObjective({
        id: uuidv4(),
        meetingId,
        objective: obj.objective,
        ownerId,
        dueDate: obj.dueDate ?? undefined,
      });
    });

    // Save decisions
    const decisions = (parsed.decisions || []).map((dec: any) => {
      return this.storage.createMeetingDecision({
        id: uuidv4(),
        meetingId,
        decision: dec.decision,
        context: dec.context ?? undefined,
      });
    });

    // Save action items
    const actionItems = (parsed.actionItems || []).map((item: any) => {
      const assigneeId = item.assigneeName
        ? nameToId.get(item.assigneeName.toLowerCase()) ?? undefined
        : undefined;
      return this.storage.createMeetingActionItem({
        id: uuidv4(),
        meetingId,
        action: item.action,
        assigneeId,
        dueDate: item.dueDate ?? undefined,
      });
    });

    // Process ticket suggestions (resolve assignee names)
    const ticketSuggestions = (parsed.ticketSuggestions || []).map((ts: any) => ({
      title: ts.title,
      description: ts.description,
      ticketType: ts.ticketType,
      priority: ts.priority,
      assigneeId: ts.assigneeName
        ? nameToId.get(ts.assigneeName.toLowerCase()) ?? undefined
        : undefined,
    }));

    return {
      meeting,
      summary: parsed.summary,
      objectives,
      decisions,
      actionItems,
      ticketSuggestions,
    };
  }

  async createTicketFromActionItemInJira(actionItemId: string): Promise<{ ticket: any; jiraKey?: string }> {
    const actionItems = this.storage.getMeetingActionItems({});
    const actionItem = actionItems.find(ai => ai.id === actionItemId);
    if (!actionItem) throw new Error('Action item not found');

    // Create local ticket if it doesn't already exist
    let ticket;
    if (actionItem.jiraTicketId) {
      ticket = this.storage.getTicket(actionItem.jiraTicketId);
    }
    if (!ticket) {
      ticket = this.storage.createTicket({
        title: actionItem.action,
        description: `Created from meeting action item.\n\nAction: ${actionItem.action}`,
        acceptanceCriteria: ['Complete the action item as described'],
        ticketType: 'task',
        priority: 'medium',
        assigneeId: actionItem.assigneeId ?? undefined,
      });
      this.storage.updateMeetingActionItem(actionItemId, { jiraTicketId: ticket.id });
    }

    // Push to Jira
    if (!this.jiraService) throw new Error('Jira service not configured');
    const jiraConfig = this.storage.getJiraConfig();
    if (!jiraConfig) throw new Error('Jira configuration not set');

    if (ticket.jiraKey) {
      return { ticket, jiraKey: ticket.jiraKey };
    }

    const teamMembers = this.storage.getTeamMembers();
    const epics = this.storage.getEpics();
    const jiraResponse = await this.jiraService.createIssue(jiraConfig, ticket, { teamMembers, epics });
    const jiraUrl = `${jiraConfig.baseUrl}/browse/${jiraResponse.key}`;
    const updatedTicket = this.storage.updateTicket(ticket.id, {
      status: 'created',
      createdInJira: true,
      jiraKey: jiraResponse.key,
      jiraUrl,
    });

    return { ticket: updatedTicket, jiraKey: jiraResponse.key };
  }
}

export const createMeetingService = (storage: StorageService, jiraService?: JiraService | null): MeetingService => {
  return new MeetingService(storage, jiraService);
};
