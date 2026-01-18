import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

import { createStorageService } from './services/storageService.js';
import { createJiraService } from './services/jiraService.js';
import { createAgentService } from './services/agentService.js';
import { createParseRouter } from './routes/parse.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createTeamRouter } from './routes/team.js';
import { createEpicsRouter } from './routes/epics.js';
import { createJiraRouter } from './routes/jira.js';
import { createAgentRouter } from './routes/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../../.env') });

const PORT = process.env.PORT || 3001;
const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, '../../../data/database.sqlite');

// Ensure data directory exists
const dataDir = dirname(DATABASE_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize storage
const storage = createStorageService(DATABASE_PATH);

// Initialize Jira and Agent services
const jiraService = createJiraService();
const agentService = createAgentService({ storage, jiraService });

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/parse', createParseRouter(storage, agentService));
app.use('/api/tickets', createTicketsRouter(storage));
app.use('/api/team', createTeamRouter(storage));
app.use('/api/epics', createEpicsRouter(storage));
app.use('/api/jira', createJiraRouter(storage));
app.use('/api/agent', createAgentRouter(agentService));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  storage.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  storage.close();
  process.exit(0);
});
