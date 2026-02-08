import { Router } from 'express';
import type {
  ApiResponse,
  JiraConfig,
  JiraConfigInput,
  JiraTestConnectionResponse,
  JiraCreateIssueResponse,
  JiraUser,
  JiraSprint,
  JiraEpic,
  JiraSyncResult,
  Ticket,
  MemberTicket,
} from '@jira-planner/shared';
import type { createStorageService } from '../services/storageService.js';
import type { JiraSyncService } from '../services/jiraSyncService.js';
import { createJiraService } from '../services/jiraService.js';

export function createJiraRouter(storage: ReturnType<typeof createStorageService>, jiraSyncService?: JiraSyncService) {
  const router = Router();

  // Get Jira configuration
  router.get('/config', (req, res) => {
    try {
      const config = storage.getJiraConfig();
      const response: ApiResponse<{ config: JiraConfig | null }> = {
        success: true,
        data: { config },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Jira config',
      };
      res.status(500).json(response);
    }
  });

  // Update Jira configuration
  router.put('/config', (req, res) => {
    try {
      const input = req.body as JiraConfigInput;
      if (!input.baseUrl || !input.projectKey) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Base URL and project key are required',
        };
        return res.status(400).json(response);
      }

      const config = storage.updateJiraConfig(input);
      const response: ApiResponse<JiraConfig> = {
        success: true,
        data: config,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Jira config',
      };
      res.status(500).json(response);
    }
  });

  // Test Jira connection
  router.post('/test', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<JiraTestConnectionResponse> = {
          success: true,
          data: {
            success: false,
            error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
          },
        };
        return res.json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<JiraTestConnectionResponse> = {
          success: true,
          data: {
            success: false,
            error: 'Jira configuration not set. Please save your configuration first.',
          },
        };
        return res.json(response);
      }

      const result = await jiraService.testConnection(config);
      const response: ApiResponse<JiraTestConnectionResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connection',
      };
      res.status(500).json(response);
    }
  });

  // Get assignable users from Jira
  router.get('/users', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const users = await jiraService.getAssignableUsers(config);
      const response: ApiResponse<{ users: JiraUser[] }> = {
        success: true,
        data: { users },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      };
      res.status(500).json(response);
    }
  });

  // Get sprints from Jira board
  router.get('/sprints', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const boardId = req.query.boardId ? parseInt(req.query.boardId as string, 10) : config.defaultBoardId;
      if (!boardId) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Board ID is required. Either pass boardId query parameter or configure default board ID.',
        };
        return res.status(400).json(response);
      }

      const sprints = await jiraService.getSprints(config, boardId);

      // Cache sprints locally
      storage.setSprints(sprints);

      const response: ApiResponse<{ sprints: JiraSprint[] }> = {
        success: true,
        data: { sprints },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sprints',
      };
      res.status(500).json(response);
    }
  });

  // Get cached sprints from local database
  router.get('/sprints/cached', (req, res) => {
    try {
      const boardId = req.query.boardId ? parseInt(req.query.boardId as string, 10) : undefined;
      const sprints = storage.getSprints(boardId);
      const response: ApiResponse<{ sprints: JiraSprint[] }> = {
        success: true,
        data: { sprints },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cached sprints',
      };
      res.status(500).json(response);
    }
  });

  // Get epics from Jira
  router.get('/epics', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const epics = await jiraService.getEpics(config);
      const response: ApiResponse<{ epics: JiraEpic[] }> = {
        success: true,
        data: { epics },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epics',
      };
      res.status(500).json(response);
    }
  });

  // Sync Jira data (users + epics) to local database
  router.post('/sync', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      let config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      // Auto-detect sprint field ID if not already configured
      if (!config.sprintFieldId) {
        const detectedSprintFieldId = await jiraService.detectSprintFieldId(config);
        if (detectedSprintFieldId) {
          storage.updateJiraConfig({
            ...config,
            sprintFieldId: detectedSprintFieldId,
          });
          config = storage.getJiraConfig()!; // Refresh config
          console.log(`Auto-detected sprint field ID: ${detectedSprintFieldId}`);
        }
      }

      // Fetch team members from team-filtered tickets (not all project users)
      const jiraUsers = await jiraService.getTeamMembersFromTickets(config);

      // Sync team members from Jira: update existing, create new
      const memberUpdateResult = storage.syncTeamMembersFromJira(
        jiraUsers.map((user) => ({
          displayName: user.displayName || user.accountId,
          jiraUsername: user.emailAddress || user.displayName || user.accountId,
          jiraAccountId: user.accountId,
        }))
      );

      // Fetch epics from Jira
      const jiraEpics = await jiraService.getEpics(config);

      // Convert Jira epics to local epics
      const epicInputs = jiraEpics.map((epic) => ({
        name: epic.name,
        key: epic.key,
        description: epic.summary,
      }));

      // Replace epics in database
      const syncedEpics = storage.replaceEpics(epicInputs);

      // Optionally sync sprints from both boards
      let sprintsSynced = 0;
      if (config.defaultBoardId) {
        const defaultSprints = await jiraService.getSprints(config, config.defaultBoardId);
        storage.setSprints(defaultSprints);
        sprintsSynced += defaultSprints.length;
      }
      if (config.designBoardId && config.designBoardId !== config.defaultBoardId) {
        const designSprints = await jiraService.getSprints(config, config.designBoardId);
        storage.setSprints(designSprints);
        sprintsSynced += designSprints.length;
      }

      const result: JiraSyncResult = {
        users: { synced: memberUpdateResult.updated, created: memberUpdateResult.created, total: jiraUsers.length },
        epics: { synced: syncedEpics.length, total: jiraEpics.length },
        sprints: { synced: sprintsSynced, total: sprintsSynced },
      };

      const response: ApiResponse<JiraSyncResult> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync Jira data',
      };
      res.status(500).json(response);
    }
  });

  // Create an epic in Jira from a local epic
  router.post('/epics/:id/create', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const epic = storage.getEpic(req.params.id);
      if (!epic) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Epic not found',
        };
        return res.status(404).json(response);
      }

      const jiraResponse = await jiraService.createEpic(config, epic);

      // Update local epic key to the Jira key
      const jiraUrl = `${config.baseUrl}/browse/${jiraResponse.key}`;
      storage.updateEpic(epic.id, { key: jiraResponse.key });

      const updatedEpic = storage.getEpic(epic.id);

      const response: ApiResponse<{ epic: typeof updatedEpic; jira: JiraCreateIssueResponse }> = {
        success: true,
        data: {
          epic: updatedEpic,
          jira: jiraResponse,
        },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Jira epic',
      };
      res.status(500).json(response);
    }
  });

  // Create single Jira issue from ticket
  router.post('/tickets/:id/create', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const ticket = storage.getTicket(req.params.id);
      if (!ticket) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket not found',
        };
        return res.status(404).json(response);
      }

      if (ticket.status !== 'approved') {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Ticket must be approved before creating in Jira',
        };
        return res.status(400).json(response);
      }

      const teamMembers = storage.getTeamMembers();
      const epics = storage.getEpics();

      // Get optional sprintId from request body
      const { sprintId } = req.body as { sprintId?: number };

      const jiraResponse = await jiraService.createIssue(
        config,
        ticket,
        { teamMembers, epics },
        { sprintId }
      );

      // Update ticket with Jira info
      const jiraUrl = `${config.baseUrl}/browse/${jiraResponse.key}`;
      const updatedTicket = storage.updateTicket(ticket.id, {
        status: 'created',
        createdInJira: true,
        jiraKey: jiraResponse.key,
        jiraUrl: jiraUrl,
      });

      const response: ApiResponse<{ ticket: Ticket; jira: JiraCreateIssueResponse }> = {
        success: true,
        data: {
          ticket: updatedTicket!,
          jira: jiraResponse,
        },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Jira issue',
      };
      res.status(500).json(response);
    }
  });

  // Bulk create Jira issues from approved tickets
  router.post('/tickets/create-all', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const approvedTickets = storage.getTickets({ status: 'approved' });
      const teamMembers = storage.getTeamMembers();
      const epics = storage.getEpics();

      const results: { ticketId: string; success: boolean; jiraKey?: string; error?: string }[] = [];

      for (const ticket of approvedTickets) {
        try {
          const jiraResponse = await jiraService.createIssue(config, ticket, {
            teamMembers,
            epics,
          });

          const jiraUrl = `${config.baseUrl}/browse/${jiraResponse.key}`;
          storage.updateTicket(ticket.id, {
            status: 'created',
            createdInJira: true,
            jiraKey: jiraResponse.key,
            jiraUrl: jiraUrl,
          });

          results.push({
            ticketId: ticket.id,
            success: true,
            jiraKey: jiraResponse.key,
          });
        } catch (error) {
          results.push({
            ticketId: ticket.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const response: ApiResponse<{ results: typeof results; total: number; successful: number }> = {
        success: true,
        data: {
          results,
          total: results.length,
          successful: results.filter((r) => r.success).length,
        },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Jira issues',
      };
      res.status(500).json(response);
    }
  });

  // Get tickets for a specific team member (character screen)
  router.get('/members/:accountId/tickets', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira credentials not configured. Set JIRA_EMAIL and JIRA_API_TOKEN environment variables.',
        };
        return res.status(400).json(response);
      }

      const config = storage.getJiraConfig();
      if (!config) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira configuration not set',
        };
        return res.status(400).json(response);
      }

      const { accountId } = req.params;
      const tickets = await jiraService.getTicketsForMember(config, accountId);

      // Map to MemberTicket format
      const memberTickets: MemberTicket[] = tickets.map((ticket) => ({
        key: ticket.key,
        summary: ticket.summary,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        updated: ticket.updated,
        sprint: ticket.sprint,
      }));

      const response: ApiResponse<{ tickets: MemberTicket[] }> = {
        success: true,
        data: { tickets: memberTickets },
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch member tickets',
      };
      res.status(500).json(response);
    }
  });

  // Sync active tickets from Jira into local database
  router.post('/sync-active-tickets', async (req, res) => {
    try {
      if (!jiraSyncService) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Jira sync service not configured',
        };
        return res.status(400).json(response);
      }

      const result = await jiraSyncService.syncActiveTickets();
      const response: ApiResponse<{ synced: number; errors: string[] }> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse<never> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync active tickets',
      };
      res.status(500).json(response);
    }
  });

  // Get available transitions for an issue
  router.get('/issues/:issueKey/transitions', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        return res.status(400).json({ success: false, error: 'Jira credentials not configured' });
      }
      const config = storage.getJiraConfig();
      if (!config) {
        return res.status(400).json({ success: false, error: 'Jira configuration not set' });
      }

      const transitions = await jiraService.getTransitions(config, req.params.issueKey);
      res.json({ success: true, data: { transitions } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transitions',
      });
    }
  });

  // Update a Jira issue
  router.put('/issues/:issueKey', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        return res.status(400).json({ success: false, error: 'Jira credentials not configured' });
      }
      const config = storage.getJiraConfig();
      if (!config) {
        return res.status(400).json({ success: false, error: 'Jira configuration not set' });
      }

      const { fields } = req.body;
      if (!fields || typeof fields !== 'object') {
        return res.status(400).json({ success: false, error: 'fields object is required' });
      }

      await jiraService.updateIssue(config, req.params.issueKey, fields);
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update issue',
      });
    }
  });

  // Assign a Jira issue
  router.post('/issues/:issueKey/assign', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        return res.status(400).json({ success: false, error: 'Jira credentials not configured' });
      }
      const config = storage.getJiraConfig();
      if (!config) {
        return res.status(400).json({ success: false, error: 'Jira configuration not set' });
      }

      const { accountId } = req.body;
      // accountId can be null (to unassign) or a string
      if (accountId !== null && typeof accountId !== 'string') {
        return res.status(400).json({ success: false, error: 'accountId must be a string or null' });
      }

      await jiraService.assignIssue(config, req.params.issueKey, accountId);
      res.json({ success: true, data: { assigned: true } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign issue',
      });
    }
  });

  // Transition a Jira issue
  router.post('/issues/:issueKey/transition', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        return res.status(400).json({ success: false, error: 'Jira credentials not configured' });
      }
      const config = storage.getJiraConfig();
      if (!config) {
        return res.status(400).json({ success: false, error: 'Jira configuration not set' });
      }

      const { transitionId } = req.body;
      if (!transitionId || typeof transitionId !== 'string') {
        return res.status(400).json({ success: false, error: 'transitionId is required' });
      }

      await jiraService.transitionIssue(config, req.params.issueKey, transitionId);
      res.json({ success: true, data: { transitioned: true } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transition issue',
      });
    }
  });

  // Add a comment to a Jira issue
  router.post('/issues/:issueKey/comment', async (req, res) => {
    try {
      const jiraService = createJiraService();
      if (!jiraService) {
        return res.status(400).json({ success: false, error: 'Jira credentials not configured' });
      }
      const config = storage.getJiraConfig();
      if (!config) {
        return res.status(400).json({ success: false, error: 'Jira configuration not set' });
      }

      const { body: commentBody } = req.body;
      if (!commentBody || typeof commentBody !== 'string') {
        return res.status(400).json({ success: false, error: 'body (comment text) is required' });
      }

      const comment = await jiraService.addComment(config, req.params.issueKey, commentBody);
      res.json({ success: true, data: { comment } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      });
    }
  });

  return router;
}
