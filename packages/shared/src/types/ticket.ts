export type TicketType = 'feature' | 'bug' | 'improvement' | 'task' | 'design';
export type TicketPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest';
export type TicketStatus = 'pending' | 'approved' | 'denied' | 'created';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  ticketType: TicketType;
  priority: TicketPriority;
  epicId: string | null;
  assigneeId: string | null;
  labels: string[];
  status: TicketStatus;
  createdInJira: boolean;
  jiraKey?: string;
  jiraUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  ticketType: TicketType;
  priority: TicketPriority;
  epicId?: string | null;
  assigneeId?: string | null;
  labels?: string[];
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  ticketType?: TicketType;
  priority?: TicketPriority;
  epicId?: string | null;
  assigneeId?: string | null;
  labels?: string[];
  status?: TicketStatus;
  createdInJira?: boolean;
  jiraKey?: string;
  jiraUrl?: string;
}
