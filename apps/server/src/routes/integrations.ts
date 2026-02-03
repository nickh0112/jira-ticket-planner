import { Router } from 'express';
import type { ApiResponse } from '@jira-planner/shared';
import { createSlackService, SLACK_SETUP_INSTRUCTIONS } from '../integrations/slack.js';
import { createMeetTranscriptService, MEET_SETUP_INSTRUCTIONS } from '../integrations/google-meet-transcripts.js';

export function createIntegrationsRouter() {
  const router = Router();
  const slackService = createSlackService();
  const meetService = createMeetTranscriptService();

  /**
   * GET /api/integrations/status
   * Check which integrations are configured and working
   */
  router.get('/status', async (req, res) => {
    const status: Record<string, { configured: boolean; connected?: boolean; error?: string }> = {
      slack: { configured: !!slackService },
      googleMeet: { configured: !!meetService },
    };

    // Test Slack connection
    if (slackService) {
      try {
        const result = await slackService.testConnection();
        status.slack.connected = result.ok;
        if (!result.ok) {
          status.slack.error = 'Connection test failed';
        }
      } catch (error) {
        status.slack.connected = false;
        status.slack.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    res.json({ success: true, data: status });
  });

  /**
   * GET /api/integrations/setup
   * Get setup instructions for integrations
   */
  router.get('/setup', (req, res) => {
    res.json({
      success: true,
      data: {
        slack: SLACK_SETUP_INSTRUCTIONS,
        googleMeet: MEET_SETUP_INSTRUCTIONS,
      },
    });
  });

  // ============ SLACK ROUTES ============

  /**
   * GET /api/integrations/slack/channels
   * List channels the user is a member of
   */
  router.get('/slack/channels', async (req, res) => {
    if (!slackService) {
      return res.status(503).json({
        success: false,
        error: 'Slack not configured. Add SLACK_USER_TOKEN to .env',
      });
    }

    try {
      const channels = await slackService.listChannels();
      const memberChannels = channels.filter((ch) => ch.isMember);
      res.json({ success: true, data: { channels: memberChannels } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list channels',
      });
    }
  });

  /**
   * POST /api/integrations/slack/context
   * Get recent messages from specified channels for AI context
   */
  router.post('/slack/context', async (req, res) => {
    if (!slackService) {
      return res.status(503).json({
        success: false,
        error: 'Slack not configured. Add SLACK_USER_TOKEN to .env',
      });
    }

    try {
      const { channelIds, sinceTs } = req.body as { channelIds: string[]; sinceTs?: string };
      
      if (!channelIds || !Array.isArray(channelIds)) {
        return res.status(400).json({
          success: false,
          error: 'channelIds array is required',
        });
      }

      const context = await slackService.getContextForTicketCreation(channelIds, sinceTs);
      res.json({ success: true, data: { context } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Slack context',
      });
    }
  });

  // ============ GOOGLE MEET ROUTES ============

  /**
   * GET /api/integrations/meet/transcripts
   * List recent transcripts from Google Drive
   */
  router.get('/meet/transcripts', async (req, res) => {
    if (!meetService) {
      return res.status(503).json({
        success: false,
        error: 'Google Meet integration not configured. Add GOG_ACCOUNT to .env',
      });
    }

    try {
      const transcripts = await meetService.findTranscripts({ maxResults: 20 });
      res.json({ success: true, data: { transcripts } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list transcripts',
      });
    }
  });

  /**
   * POST /api/integrations/meet/sync
   * Process new transcripts since last sync
   */
  router.post('/meet/sync', async (req, res) => {
    if (!meetService) {
      return res.status(503).json({
        success: false,
        error: 'Google Meet integration not configured. Add GOG_ACCOUNT to .env',
      });
    }

    try {
      const processed = await meetService.processNewTranscripts();
      res.json({
        success: true,
        data: {
          processed: processed.length,
          transcripts: processed,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync transcripts',
      });
    }
  });

  /**
   * POST /api/integrations/meet/process
   * Process a specific transcript by file ID or name
   */
  router.post('/meet/process', async (req, res) => {
    if (!meetService) {
      return res.status(503).json({
        success: false,
        error: 'Google Meet integration not configured. Add GOG_ACCOUNT to .env',
      });
    }

    try {
      const { fileId } = req.body as { fileId: string };
      
      if (!fileId) {
        return res.status(400).json({
          success: false,
          error: 'fileId is required',
        });
      }

      const result = await meetService.processFile(fileId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Transcript not found or could not be processed',
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process transcript',
      });
    }
  });

  return router;
}
