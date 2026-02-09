import { Router } from 'express';
import type {
  ApiResponse,
  TicketListResponse,
  CreateTicketInput,
  UpdateTicketInput,
  StatusUpdateRequest,
  Ticket,
  TicketStatus,
} from '@jira-planner/shared';
import type { createStorageService } from '../services/storageService.js';

export function createTicketsRouter(storage: ReturnType<typeof createStorageService>) {
  const router = Router();

  // Create ticket
  router.post('/', (req, res) => {
    try {
      const input = req.body as CreateTicketInput;
      if (!input.title || !input.description) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Title and description are required',
        };
        return res.status(400).json(response);
      }
      const ticket = storage.createTicket(input);
      const response: ApiResponse<Ticket> = {
        success: true,
        data: ticket,
      };
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create ticket',
      };
      res.status(500).json(response);
    }
  });

  // List tickets with optional filters
  router.get('/', (req, res) => {
    try {
      const { status, epicId, assigneeId } = req.query;
      const filters: { status?: TicketStatus; epicId?: string; assigneeId?: string } = {};

      if (status && typeof status === 'string') {
        filters.status = status as TicketStatus;
      }
      if (epicId && typeof epicId === 'string') {
        filters.epicId = epicId;
      }
      if (assigneeId && typeof assigneeId === 'string') {
        filters.assigneeId = assigneeId;
      }

      const tickets = storage.getTickets(filters);
      const response: ApiResponse<TicketListResponse> = {
        success: true,
        data: { tickets, total: tickets.length },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tickets',
      };
      res.status(500).json(response);
    }
  });

  // Get related tickets by feature group
  router.get('/:id/related', (req, res) => {
    try {
      const ticket = storage.getTicket(req.params.id);
      if (!ticket) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }

      if (!ticket.featureGroupId) {
        const response: ApiResponse<{ tickets: Ticket[] }> = {
          success: true,
          data: { tickets: [] },
        };
        return res.json(response);
      }

      const related = storage.getTicketsByFeatureGroup(ticket.featureGroupId)
        .filter((t) => t.id !== ticket.id);

      const response: ApiResponse<{ tickets: Ticket[] }> = {
        success: true,
        data: { tickets: related },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch related tickets',
      };
      res.status(500).json(response);
    }
  });

  // Get single ticket
  router.get('/:id', (req, res) => {
    try {
      const ticket = storage.getTicket(req.params.id);
      if (!ticket) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<Ticket> = {
        success: true,
        data: ticket,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ticket',
      };
      res.status(500).json(response);
    }
  });

  // Update ticket
  router.put('/:id', (req, res) => {
    try {
      const input = req.body as UpdateTicketInput;
      const ticket = storage.updateTicket(req.params.id, input);
      if (!ticket) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<Ticket> = {
        success: true,
        data: ticket,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update ticket',
      };
      res.status(500).json(response);
    }
  });

  // Update ticket status
  router.patch('/:id/status', (req, res) => {
    try {
      const { status } = req.body as StatusUpdateRequest;
      if (!['pending', 'approved', 'denied', 'created'].includes(status)) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Invalid status',
        };
        return res.status(400).json(response);
      }

      const ticket = storage.updateTicket(req.params.id, { status });
      if (!ticket) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<Ticket> = {
        success: true,
        data: ticket,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update ticket status',
      };
      res.status(500).json(response);
    }
  });

  // Delete ticket
  router.delete('/:id', (req, res) => {
    try {
      const deleted = storage.deleteTicket(req.params.id);
      if (!deleted) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }
      const response: ApiResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete ticket',
      };
      res.status(500).json(response);
    }
  });

  return router;
}
