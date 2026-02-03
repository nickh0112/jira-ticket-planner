/**
 * Google Meet Transcript Ingestion
 * 
 * Google Meet auto-saves transcripts to Drive when enabled.
 * This service polls Drive for new transcripts and sends them to the parse endpoint.
 * 
 * Prerequisites:
 * - gog CLI installed and authenticated (gog auth add your@email.com --services drive)
 * - Meet transcript saving enabled in Google Meet settings
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
}

interface TranscriptMetadata {
  fileId: string;
  fileName: string;
  processedAt: string;
  ticketsCreated: number;
}

export class GoogleMeetTranscriptService {
  private account: string;
  private parseEndpoint: string;
  private stateFile: string;
  private processedIds: Set<string> = new Set();

  constructor(config: {
    account: string;
    parseEndpoint?: string;
    stateFile?: string;
  }) {
    this.account = config.account;
    this.parseEndpoint = config.parseEndpoint || 'http://localhost:3001/api/parse';
    this.stateFile = config.stateFile || './data/meet-transcripts-state.json';
    this.loadState();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        this.processedIds = new Set(data.processedIds || []);
        console.log(`[meet] Loaded state: ${this.processedIds.size} previously processed transcripts`);
      }
    } catch (error) {
      console.error('[meet] Failed to load state:', error);
    }
  }

  private saveState(): void {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.stateFile,
        JSON.stringify({ processedIds: Array.from(this.processedIds) }, null, 2)
      );
    } catch (error) {
      console.error('[meet] Failed to save state:', error);
    }
  }

  /**
   * Search Drive for Google Meet transcripts
   * Meet transcripts are typically named like "Meeting transcript - <title>"
   * and are Google Docs (application/vnd.google-apps.document)
   */
  async findTranscripts(options: { maxResults?: number; newerThan?: string } = {}): Promise<DriveFile[]> {
    const { maxResults = 20, newerThan } = options;

    // Build search query for Meet transcripts
    // They're typically in "Meet Recordings" folder or have "transcript" in name
    let query = 'name contains "transcript" and mimeType = "application/vnd.google-apps.document"';
    if (newerThan) {
      query += ` and modifiedTime > "${newerThan}"`;
    }

    try {
      const { stdout } = await execAsync(
        `gog drive search "${query}" --max ${maxResults} --account "${this.account}" --json`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const files = JSON.parse(stdout);
      console.log(`[meet] Found ${files.length} transcript files`);
      return files;
    } catch (error) {
      console.error('[meet] Failed to search Drive:', error);
      return [];
    }
  }

  /**
   * Download transcript content as text
   */
  async getTranscriptContent(fileId: string): Promise<string | null> {
    try {
      // Export Google Doc as plain text
      const { stdout } = await execAsync(
        `gog docs cat "${fileId}" --account "${this.account}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return stdout;
    } catch (error) {
      console.error(`[meet] Failed to get transcript ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Send transcript to parse endpoint for ticket extraction
   */
  async parseTranscript(content: string): Promise<{ success: boolean; ticketCount?: number }> {
    try {
      const response = await fetch(this.parseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: content }),
      });

      if (!response.ok) {
        throw new Error(`Parse endpoint returned ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        ticketCount: data.data?.tickets?.length || 0,
      };
    } catch (error) {
      console.error('[meet] Failed to parse transcript:', error);
      return { success: false };
    }
  }

  /**
   * Process new transcripts since last check
   */
  async processNewTranscripts(): Promise<TranscriptMetadata[]> {
    const processed: TranscriptMetadata[] = [];

    // Find transcripts from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const transcripts = await this.findTranscripts({ newerThan: sevenDaysAgo });

    for (const file of transcripts) {
      // Skip already processed
      if (this.processedIds.has(file.id)) {
        continue;
      }

      console.log(`[meet] Processing transcript: ${file.name}`);

      const content = await this.getTranscriptContent(file.id);
      if (!content) {
        console.log(`[meet] Skipping ${file.name} - could not retrieve content`);
        continue;
      }

      const result = await this.parseTranscript(content);
      
      // Mark as processed regardless of success (to avoid retrying bad files)
      this.processedIds.add(file.id);

      if (result.success) {
        const metadata: TranscriptMetadata = {
          fileId: file.id,
          fileName: file.name,
          processedAt: new Date().toISOString(),
          ticketsCreated: result.ticketCount || 0,
        };
        processed.push(metadata);
        console.log(`[meet] Created ${result.ticketCount} tickets from ${file.name}`);
      }
    }

    this.saveState();
    return processed;
  }

  /**
   * Manual ingestion - process a specific file by ID or name
   */
  async processFile(fileIdOrName: string): Promise<TranscriptMetadata | null> {
    let fileId = fileIdOrName;

    // If it looks like a name, search for it
    if (!fileIdOrName.match(/^[a-zA-Z0-9_-]{25,}$/)) {
      const files = await this.findTranscripts();
      const match = files.find((f) => f.name.includes(fileIdOrName));
      if (!match) {
        console.log(`[meet] No file found matching: ${fileIdOrName}`);
        return null;
      }
      fileId = match.id;
    }

    const content = await this.getTranscriptContent(fileId);
    if (!content) return null;

    const result = await this.parseTranscript(content);
    if (!result.success) return null;

    return {
      fileId,
      fileName: fileIdOrName,
      processedAt: new Date().toISOString(),
      ticketsCreated: result.ticketCount || 0,
    };
  }
}

/**
 * Setup instructions for Google Meet transcript auto-ingestion
 */
export const MEET_SETUP_INSTRUCTIONS = `
# Google Meet Transcript Auto-Ingestion Setup

## 1. Enable Meet Transcripts (in Google Meet)
- Go to Google Meet settings
- Enable "Turn on transcripts" for meetings you organize
- Transcripts auto-save to your Google Drive

## 2. Setup gog CLI
\`\`\`bash
# Install gog (if not already)
brew install steipete/tap/gogcli

# Authenticate with your Google account (needs Drive access)
gog auth credentials /path/to/client_secret.json
gog auth add your-work@email.com --services drive,docs
\`\`\`

## 3. Configure the integration
Add to your .env:
\`\`\`
GOG_ACCOUNT=your-work@email.com
\`\`\`

## 4. Run the ingestion
The service will:
- Poll Drive for new transcript files
- Extract text from Google Docs
- Send to /api/parse for ticket creation
- Track processed files to avoid duplicates

Manual trigger: POST /api/transcripts/sync
`;

export const createMeetTranscriptService = (): GoogleMeetTranscriptService | null => {
  const account = process.env.GOG_ACCOUNT;
  if (!account) {
    console.log('[meet] No GOG_ACCOUNT configured');
    return null;
  }
  return new GoogleMeetTranscriptService({ account });
};
