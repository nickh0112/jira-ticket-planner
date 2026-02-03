# Integrations Setup Guide

## Overview

The Jira Ticket Planner now supports two integrations for automatic data ingestion:

1. **Slack** - Read messages from channels you're in (no admin required)
2. **Google Meet Transcripts** - Auto-import meeting transcripts from Google Drive

---

## Slack Integration (User OAuth)

This uses a User OAuth Token, which means you authorize your own Slack account without needing workspace admin permissions.

### Setup Steps

1. **Create a Slack App**
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name: `Jira Planner Personal`
   - Select your workspace

2. **Add User Token Scopes**
   - Go to "OAuth & Permissions" in the sidebar
   - Scroll to "User Token Scopes"
   - Add these scopes:
     - `channels:history` - Read public channel messages
     - `channels:read` - List public channels
     - `groups:history` - Read private channel messages (ones you're in)
     - `groups:read` - List private channels (ones you're in)
     - `users:read` - Get user names for messages

3. **Install to Workspace**
   - Click "Install to Workspace" at the top
   - Authorize with YOUR account (not admin install)
   - Copy the **User OAuth Token** (starts with `xoxp-`)

4. **Configure**
   ```bash
   # Add to your .env file
   SLACK_USER_TOKEN=xoxp-your-token-here
   ```

### Usage

```bash
# Check connection
curl http://localhost:3001/api/integrations/status

# List channels you're in
curl http://localhost:3001/api/integrations/slack/channels

# Get context from specific channels for AI
curl -X POST http://localhost:3001/api/integrations/slack/context \
  -H "Content-Type: application/json" \
  -d '{"channelIds": ["C01XXXXXX", "C02YYYYYY"]}'
```

---

## Google Meet Transcript Integration

This automatically pulls meeting transcripts from your Google Drive and creates tickets from them.

### Prerequisites

1. **Enable Meet Transcripts** (in Google Meet settings)
   - Transcripts must be enabled for your meetings
   - They auto-save to Google Drive

2. **Install gog CLI**
   ```bash
   brew install steipete/tap/gogcli
   ```

3. **Authenticate gog**
   ```bash
   # First, get OAuth credentials from Google Cloud Console
   # Download client_secret.json
   
   gog auth credentials /path/to/client_secret.json
   gog auth add your-work@email.com --services drive,docs
   ```

4. **Configure**
   ```bash
   # Add to your .env file
   GOG_ACCOUNT=your-work@email.com
   ```

### Usage

```bash
# List recent transcripts
curl http://localhost:3001/api/integrations/meet/transcripts

# Sync new transcripts (auto-creates tickets)
curl -X POST http://localhost:3001/api/integrations/meet/sync

# Process a specific transcript
curl -X POST http://localhost:3001/api/integrations/meet/process \
  -H "Content-Type: application/json" \
  -d '{"fileId": "1abc123..."}'
```

---

## API Reference

### `GET /api/integrations/status`
Check which integrations are configured and connected.

### `GET /api/integrations/setup`
Get setup instructions as JSON.

### Slack

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations/slack/channels` | GET | List channels you're a member of |
| `/api/integrations/slack/context` | POST | Get formatted messages for AI context |

### Google Meet

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations/meet/transcripts` | GET | List recent transcripts from Drive |
| `/api/integrations/meet/sync` | POST | Process new transcripts since last sync |
| `/api/integrations/meet/process` | POST | Process a specific transcript by ID |

---

## Automation Ideas

### Cron Job for Meet Transcripts
```bash
# Every hour, sync new transcripts
0 * * * * curl -X POST http://localhost:3001/api/integrations/meet/sync
```

### Slack Daily Digest
Pull yesterday's messages and summarize action items.

### Mort Integration
Have Mort periodically check these integrations and alert you to new items.
