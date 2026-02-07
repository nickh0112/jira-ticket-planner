import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

import { createStorageService } from './services/storageService.js';
import { createJiraService } from './services/jiraService.js';
import { createAgentService } from './services/agentService.js';
import { createJiraSyncService } from './services/jiraSyncService.js';
import { createPMService } from './services/pmService.js';
import { createBitbucketService } from './services/bitbucketService.js';
import { createBitbucketSyncService } from './services/bitbucketSyncService.js';
import { createAutomationEngine } from './services/automationEngine.js';
import { ActionExecutor } from './services/automation/actionExecutor.js';
import { PMCheckModule } from './services/automation/pmCheck.js';
import { StaleTicketCheckModule } from './services/automation/staleTicketCheck.js';
import { AccountabilityCheckModule } from './services/automation/accountabilityCheck.js';
import { SprintHealthCheckModule } from './services/automation/sprintHealthCheck.js';
import { createMeetingService } from './services/meetingService.js';
import { createSlackService } from './services/slackService.js';
import { createSlackSyncService } from './services/slackSyncService.js';
import { createParseRouter } from './routes/parse.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createTeamRouter } from './routes/team.js';
import { createEpicsRouter } from './routes/epics.js';
import { createJiraRouter } from './routes/jira.js';
import { createAgentRouter } from './routes/agent.js';
import { createSyncRouter } from './routes/sync.js';
import { createWorldRouter, createTeamExtensionRouter } from './routes/world.js';
import { createIntegrationsRouter } from './routes/integrations.js';
import { createPMRouter } from './routes/pm.js';
import { createIdeasRouter } from './routes/ideas.js';
import { createSettingsRouter } from './routes/settings.js';
import { createBitbucketRouter } from './routes/bitbucket.js';
import { createAutomationRouter } from './routes/automation.js';
import { createMeetingsRouter } from './routes/meetings.js';
import { createReportsRouter } from './routes/reports.js';
import { createSlackRouter } from './routes/slack.js';
import { createIdeasService } from './services/ideasService.js';
import { AppError } from '@jira-planner/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (skip in production — env vars are injected by Railway)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: join(__dirname, '../../../.env') });
}

const PORT = Number(process.env.PORT) || 8005;
const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, '../../../data/database.sqlite');

// Ensure data directory exists
const dataDir = dirname(DATABASE_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize storage
const storage = createStorageService(DATABASE_PATH);

// Initialize Jira, Agent, and Sync services
const jiraService = createJiraService();
const agentService = createAgentService({ storage, jiraService });
const syncService = createJiraSyncService({ storage, jiraService });

// Initialize PM services
const pmService = createPMService({ storage, agentService, jiraService });

// Initialize Ideas service
const ideasService = createIdeasService({ storage, agentService, jiraService });

// Initialize Meeting service
const meetingService = createMeetingService(storage, jiraService);

// Initialize Bitbucket services
// Bitbucket service is created on-demand since config is stored in DB
const getBitbucketService = () => {
  const config = storage.getBitbucketConfig();
  if (!config) return null;
  return createBitbucketService({
    email: config.email,
    appPassword: config.appPassword,
  });
};

const bitbucketSyncService = createBitbucketSyncService({
  storage,
  getBitbucketService,
});

// Initialize Slack services (on-demand like Bitbucket)
const getSlackService = () => {
  const config = storage.getSlackConfig();
  if (!config || !config.botToken) return null;
  return createSlackService(config.botToken);
};

const slackSyncService = createSlackSyncService({
  storage,
  getSlackService,
});

// Initialize ActionExecutor for Jira write-back
const actionExecutor = new ActionExecutor({ storage, jiraService });

// Initialize Automation Engine (replaces pmBackgroundService)
const automationEngine = createAutomationEngine({ storage, executor: actionExecutor });
automationEngine.registerCheck(new PMCheckModule(pmService, syncService));
automationEngine.registerCheck(new StaleTicketCheckModule());
automationEngine.registerCheck(new AccountabilityCheckModule());
automationEngine.registerCheck(new SprintHealthCheckModule());

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/parse', createParseRouter(storage, agentService));
app.use('/api/tickets', createTicketsRouter(storage));
app.use('/api/team', createTeamRouter(storage));
app.use('/api/team', createTeamExtensionRouter(storage)); // RTS extensions
app.use('/api/epics', createEpicsRouter(storage));
app.use('/api/jira', createJiraRouter(storage, syncService));
app.use('/api/agent', createAgentRouter(agentService));
app.use('/api/sync', createSyncRouter(storage, syncService));
app.use('/api/world', createWorldRouter(storage));
app.use('/api/integrations', createIntegrationsRouter());
app.use('/api/pm', createPMRouter(storage, pmService, automationEngine));
app.use('/api/ideas', createIdeasRouter(ideasService));
app.use('/api/settings', createSettingsRouter(storage));
app.use('/api/bitbucket', createBitbucketRouter(storage, getBitbucketService, bitbucketSyncService));
app.use('/api/automation', createAutomationRouter(storage, automationEngine, actionExecutor));
app.use('/api/meetings', createMeetingsRouter(storage, meetingService));
app.use('/api/reports', createReportsRouter(storage));
app.use('/api/slack', createSlackRouter(storage, getSlackService, slackSyncService));

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDistPath, 'index.html'));
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
  } else {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Start auto-sync if enabled
  syncService.startAutoSync();

  // Start Bitbucket auto-sync if enabled
  bitbucketSyncService.startAutoSync();

  // Start Slack auto-sync if enabled
  slackSyncService.startAutoSync();

  // Start automation engine (replaces pmBackgroundService)
  automationEngine.startEngine();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  syncService.stopAutoSync();
  bitbucketSyncService.stopAutoSync();
  slackSyncService.stopAutoSync();
  automationEngine.stopEngine();
  storage.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  syncService.stopAutoSync();
  bitbucketSyncService.stopAutoSync();
  slackSyncService.stopAutoSync();
  automationEngine.stopEngine();
  storage.close();
  process.exit(0);
});
