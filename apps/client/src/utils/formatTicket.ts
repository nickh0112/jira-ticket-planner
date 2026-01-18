import type { Ticket, TeamMember, Epic } from '@jira-planner/shared';

interface FormatContext {
  teamMembers: TeamMember[];
  epics: Epic[];
}

export function formatTicketForJira(
  ticket: Ticket,
  context: FormatContext
): string {
  const assignee = ticket.assigneeId
    ? context.teamMembers.find((m) => m.id === ticket.assigneeId)
    : null;
  const epic = ticket.epicId
    ? context.epics.find((e) => e.id === ticket.epicId)
    : null;

  const parts: string[] = [];

  // Description
  parts.push('h3. Description');
  parts.push(ticket.description);
  parts.push('');

  // Acceptance Criteria
  if (ticket.acceptanceCriteria.length > 0) {
    parts.push('h3. Acceptance Criteria');
    ticket.acceptanceCriteria.forEach((criteria) => {
      parts.push(`* ${criteria}`);
    });
    parts.push('');
  }

  // Metadata
  parts.push('----');
  parts.push(`*Type:* ${ticket.ticketType}`);
  parts.push(`*Priority:* ${ticket.priority}`);

  if (epic) {
    parts.push(`*Epic:* ${epic.key} - ${epic.name}`);
  }

  if (assignee) {
    const jiraHandle = assignee.jiraUsername
      ? `@${assignee.jiraUsername}`
      : assignee.name;
    parts.push(`*Assignee:* ${jiraHandle}`);
  }

  return parts.join('\n');
}

export function formatTicketTitle(ticket: Ticket): string {
  return ticket.title;
}

export function formatAllApprovedTickets(
  tickets: Ticket[],
  context: FormatContext
): string {
  const approvedTickets = tickets.filter((t) => t.status === 'approved');

  if (approvedTickets.length === 0) {
    return 'No approved tickets to copy.';
  }

  return approvedTickets
    .map((ticket, index) => {
      const header = `=== Ticket ${index + 1}: ${ticket.title} ===\n`;
      const body = formatTicketForJira(ticket, context);
      return header + body;
    })
    .join('\n\n');
}
