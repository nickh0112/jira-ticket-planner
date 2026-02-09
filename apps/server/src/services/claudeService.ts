import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateTicketInput,
  TeamMember,
  Epic,
  Ticket,
  TicketEnhancements,
  EpicSuggestion,
  AssigneeSuggestion,
  InferredSkill,
  EpicCategory,
  IdeaMessage,
  IdeaPRD,
  BrainstormResponse,
  PRDGenerationResponse,
  PRDUpdateResponse,
  TicketSplitResponse,
  TicketUpdateResponse,
  IdeaTicketProposal,
  CreateIdeaPRDInput,
  ProjectContext,
} from '@jira-planner/shared';

// Context for brainstorming prompts
export interface BrainstormContext {
  projectContext: ProjectContext | null;
  teamMembers: TeamMember[];
  epics: Epic[];
  recentTickets: Ticket[];
}
import type { JiraTicketForLearning } from './jiraService.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export async function callClaudeWithRetry(
  params: { model?: string; max_tokens: number; system: string; messages: any[] },
  retries = 3,
  delay = 1000
): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: params.model || 'claude-sonnet-4-20250514',
        max_tokens: params.max_tokens,
        system: params.system,
        messages: params.messages,
      });
      return response;
    } catch (error: any) {
      const isRateLimit = error?.status === 429;
      const isServerError = error?.status >= 500;
      if (attempt === retries - 1 || (!isRateLimit && !isServerError)) {
        throw error;
      }
      const waitTime = delay * Math.pow(2, attempt);
      console.log(`[claude] Rate limited or server error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

interface ParseContext {
  teamMembers: TeamMember[];
  epics: Epic[];
}

export async function parseTranscript(transcript: string, context: ParseContext): Promise<CreateTicketInput[]> {
  const teamMembersInfo = context.teamMembers
    .map((m) => `- ${m.name} (${m.role}): Skills - ${m.skills.join(', ')}${m.jiraUsername ? `, JIRA: @${m.jiraUsername}` : ''}`)
    .join('\n');

  const epicsInfo = context.epics.map((e) => `- ${e.key}: ${e.name} - ${e.description}`).join('\n');

  const systemPrompt = `You are a JIRA ticket extraction assistant for the Foam platform's Sdwad DI team. Your job is to analyze call transcripts and extract actionable JIRA tickets.

When extracting tickets:
1. Identify distinct work items, features, bugs, improvements, or tasks mentioned
2. Create clear, actionable titles
3. Write detailed descriptions that capture the requirement
4. Generate specific acceptance criteria
5. Determine appropriate ticket type (feature, bug, improvement, task)
6. Assess priority based on urgency indicators in the conversation
7. If team members are provided, suggest the most appropriate assignee based on their skills
8. If epics are provided, suggest the most relevant epic for each ticket
9. Suggest relevant labels for categorization (e.g., "backend", "frontend", "api", "database", "auth", "ui", "performance", "security", "testing", "documentation")

**IMPORTANT: Split multi-layer features into separate tickets**
- If a feature requires work across frontend, backend, or ML, create a SEPARATE ticket for each layer
- Give related tickets a shared "featureGroup" identifier (use the feature name as a slug, e.g., "user-authentication")
- Each split ticket should have the SAME epicId
- Include the layer in the title (e.g., "User Auth - Backend", "User Auth - Frontend")

Example: "Build user profile with UI and API" becomes:
- "User Profile - Backend" (labels: ["backend", "api"], featureGroup: "user-profile")
- "User Profile - Frontend" (labels: ["frontend", "react"], featureGroup: "user-profile")

Available team members:
${teamMembersInfo || 'None configured'}

Available epics:
${epicsInfo || 'None configured'}

Respond with a JSON array of tickets. Each ticket should have:
- title: string (clear, concise; include layer suffix when split)
- description: string (detailed explanation)
- acceptanceCriteria: string[] (specific, testable criteria)
- ticketType: "feature" | "bug" | "improvement" | "task"
- priority: "highest" | "high" | "medium" | "low" | "lowest"
- assigneeId: string | null (ID of suggested team member, or null)
- epicId: string | null (ID of suggested epic, or null)
- labels: string[] (relevant labels like "backend", "frontend", "api", etc.)
- featureGroup: string | null (shared slug for split tickets, e.g., "user-authentication")

Only return the JSON array, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Please extract JIRA tickets from this call transcript:\n\n${transcript}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    // Try to parse the response as JSON
    let jsonText = content.text.trim();

    // Handle if Claude wraps the JSON in markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const tickets = JSON.parse(jsonText) as (CreateTicketInput & { featureGroup?: string })[];

    // Map featureGroup slugs to shared UUIDs
    const featureGroupMap = new Map<string, string>();

    // Validate the structure and resolve IDs
    return tickets.map((ticket) => {
      // Resolve epicId: could be a key like "FOAM-123" or a UUID
      let resolvedEpicId: string | null = null;
      if (ticket.epicId) {
        // First try exact match on ID
        const epicById = context.epics.find((e) => e.id === ticket.epicId);
        if (epicById) {
          resolvedEpicId = epicById.id;
        } else {
          // Try matching by key (e.g., "FOAM-123")
          const epicByKey = context.epics.find((e) => e.key === ticket.epicId);
          resolvedEpicId = epicByKey?.id ?? null;
        }
      }

      // Resolve assigneeId: could be a name, jiraUsername, or UUID
      let resolvedAssigneeId: string | null = null;
      if (ticket.assigneeId) {
        // First try exact match on ID
        const memberById = context.teamMembers.find((m) => m.id === ticket.assigneeId);
        if (memberById) {
          resolvedAssigneeId = memberById.id;
        } else {
          // Try matching by name or jiraUsername
          const memberByName = context.teamMembers.find(
            (m) =>
              m.name.toLowerCase() === ticket.assigneeId?.toLowerCase() ||
              m.jiraUsername?.toLowerCase() === ticket.assigneeId?.toLowerCase()
          );
          resolvedAssigneeId = memberByName?.id ?? null;
        }
      }

      // Convert featureGroup slug to shared UUID
      let featureGroupId: string | null = null;
      if (ticket.featureGroup) {
        if (!featureGroupMap.has(ticket.featureGroup)) {
          featureGroupMap.set(ticket.featureGroup, uuidv4());
        }
        featureGroupId = featureGroupMap.get(ticket.featureGroup)!;
      }

      return {
        title: String(ticket.title || ''),
        description: String(ticket.description || ''),
        acceptanceCriteria: Array.isArray(ticket.acceptanceCriteria)
          ? ticket.acceptanceCriteria.map(String)
          : [],
        ticketType: validateTicketType(ticket.ticketType),
        priority: validatePriority(ticket.priority),
        assigneeId: resolvedAssigneeId,
        epicId: resolvedEpicId,
        labels: Array.isArray(ticket.labels) ? ticket.labels.map(String) : [],
        featureGroupId,
      };
    });
  } catch (error) {
    console.error('Failed to parse Claude response:', content.text);
    throw new Error('Failed to parse ticket extraction response');
  }
}

function validateTicketType(type: string): 'feature' | 'bug' | 'improvement' | 'task' {
  const validTypes = ['feature', 'bug', 'improvement', 'task'] as const;
  return validTypes.includes(type as any) ? (type as any) : 'task';
}

function validatePriority(priority: string): 'highest' | 'high' | 'medium' | 'low' | 'lowest' {
  const validPriorities = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
  return validPriorities.includes(priority as any) ? (priority as any) : 'medium';
}

/**
 * Enhance a ticket with detailed technical context, acceptance criteria, and AI coding notes
 */
export async function enhanceTicketDescription(
  ticket: Ticket,
  context: {
    teamMembers: TeamMember[];
    epics: Epic[];
    inferredSkills: InferredSkill[];
    qualityThreshold: 'basic' | 'standard' | 'comprehensive';
  }
): Promise<TicketEnhancements> {
  const thresholdRequirements = {
    basic: 'Add 1-2 acceptance criteria if missing',
    standard: 'Add 3-5 acceptance criteria, brief technical context',
    comprehensive:
      'Add 5-8 acceptance criteria, detailed technical context, success metrics, and AI coding agent notes for implementation',
  };

  const systemPrompt = `You are a senior software architect enhancing JIRA tickets for a development team.
Your goal is to make tickets comprehensive enough for both human engineers and AI coding agents to implement.

Quality threshold: ${context.qualityThreshold}
Requirements: ${thresholdRequirements[context.qualityThreshold]}

When enhancing tickets:
1. Keep the original intent but add technical depth
2. Write acceptance criteria that are specific and testable
3. Add technical context explaining architecture implications
4. Include success metrics for measuring completion
5. Add AI coding notes with implementation hints, file locations to check, and edge cases to handle

Format your response as JSON with this structure:
{
  "enhancedDescription": "Enhanced description with more technical detail...",
  "addedAcceptanceCriteria": ["Criterion 1", "Criterion 2", ...],
  "successMetrics": ["Metric 1", "Metric 2"],
  "technicalContext": "Architecture and implementation notes...",
  "aiCodingNotes": "Implementation hints for AI coding agents..."
}

Only return the JSON, no other text.`;

  const ticketContext = `
Ticket Title: ${ticket.title}
Original Description: ${ticket.description}
Ticket Type: ${ticket.ticketType}
Priority: ${ticket.priority}
Existing Acceptance Criteria: ${ticket.acceptanceCriteria.length > 0 ? ticket.acceptanceCriteria.join(', ') : 'None'}
`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Please enhance this ticket:\n${ticketContext}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText);

    return {
      originalDescription: ticket.description,
      enhancedDescription: result.enhancedDescription || ticket.description,
      addedAcceptanceCriteria: Array.isArray(result.addedAcceptanceCriteria)
        ? result.addedAcceptanceCriteria
        : [],
      successMetrics: Array.isArray(result.successMetrics) ? result.successMetrics : [],
      technicalContext: result.technicalContext || '',
      aiCodingNotes: result.aiCodingNotes,
    };
  } catch (error) {
    console.error('Failed to parse enhancement response:', content.text);
    throw new Error('Failed to parse ticket enhancement response');
  }
}

/**
 * Analyze Jira tickets to infer team member skills
 */
export async function inferSkillsFromTickets(
  teamMemberId: string,
  teamMemberName: string,
  tickets: JiraTicketForLearning[]
): Promise<{ skill: string; confidence: number; evidence: string }[]> {
  if (tickets.length === 0) {
    return [];
  }

  const systemPrompt = `You are analyzing JIRA tickets to infer the technical skills of a team member.
Based on the tickets they've completed, identify their skills and expertise areas.

For each skill:
- Provide a confidence score from 0.0 to 1.0 (1.0 = very confident)
- Provide brief evidence explaining why you inferred this skill

Format your response as JSON array:
[
  { "skill": "TypeScript", "confidence": 0.9, "evidence": "Completed 5 TypeScript feature tickets" },
  { "skill": "React", "confidence": 0.8, "evidence": "Built multiple React components" }
]

Focus on technical skills like:
- Programming languages (TypeScript, Python, etc.)
- Frameworks (React, Node.js, etc.)
- Domains (Authentication, API design, Database, etc.)
- Tools (AWS, Docker, etc.)

Only return the JSON array, no other text.`;

  const ticketSummaries = tickets
    .slice(0, 30)
    .map((t) => `- ${t.summary} (${t.issueType}, ${t.status})`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Team member: ${teamMemberName}\n\nCompleted tickets:\n${ticketSummaries}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return [];
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const skills = JSON.parse(jsonText);
    return Array.isArray(skills)
      ? skills.map((s: any) => ({
          skill: String(s.skill || ''),
          confidence: Number(s.confidence) || 0.5,
          evidence: String(s.evidence || ''),
        }))
      : [];
  } catch (error) {
    console.error('Failed to parse skills inference response:', content.text);
    return [];
  }
}

/**
 * Categorize an epic based on its tickets
 */
export async function categorizeEpic(
  epicKey: string,
  epicName: string,
  tickets: JiraTicketForLearning[]
): Promise<{ category: string; keywords: string[] }[]> {
  if (tickets.length === 0) {
    return [];
  }

  const systemPrompt = `You are analyzing JIRA tickets under an epic to categorize it.
Based on the tickets, identify what categories this epic belongs to and relevant keywords for matching.

Format your response as JSON array:
[
  { "category": "Authentication", "keywords": ["login", "auth", "security", "session"] },
  { "category": "Frontend", "keywords": ["UI", "component", "React", "styling"] }
]

Categories should be broad enough to match similar tickets but specific enough to be useful.

Only return the JSON array, no other text.`;

  const ticketSummaries = tickets
    .slice(0, 20)
    .map((t) => `- ${t.summary}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Epic: ${epicKey} - ${epicName}\n\nTickets in this epic:\n${ticketSummaries}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return [];
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const categories = JSON.parse(jsonText);
    return Array.isArray(categories)
      ? categories.map((c: any) => ({
          category: String(c.category || ''),
          keywords: Array.isArray(c.keywords) ? c.keywords.map(String) : [],
        }))
      : [];
  } catch (error) {
    console.error('Failed to parse epic categorization response:', content.text);
    return [];
  }
}

/**
 * Suggest an epic for a ticket based on semantic matching
 * @param enrichedDescriptions - Map of epic ID to enriched description (for epics with poor descriptions)
 */
export async function suggestEpicForTicket(
  ticket: { title: string; description: string; ticketType: string },
  epics: Epic[],
  epicCategories: EpicCategory[],
  enrichedDescriptions?: Map<string, string>
): Promise<EpicSuggestion> {
  if (epics.length === 0) {
    return createNewEpicProposal(ticket);
  }

  const systemPrompt = `You are matching a JIRA ticket to existing epics.
Analyze the ticket and find the best matching epic, or propose a new one if none fit well.

Response format (JSON):
For matching an existing epic:
{
  "type": "match",
  "epicKey": "PROJ-123",
  "confidence": 0.85,
  "reasoning": "This ticket involves authentication which matches the Auth epic"
}

For proposing a new epic:
{
  "type": "create",
  "confidence": 0.7,
  "reasoning": "No existing epic covers API documentation",
  "newEpicProposal": {
    "name": "API Documentation",
    "key": "api-docs",
    "description": "All tickets related to API documentation and developer guides"
  }
}

Confidence thresholds:
- 0.7+: High confidence match
- 0.4-0.7: Suggest but flag for review
- <0.4: Propose new epic

Only return the JSON, no other text.`;

  const epicInfo = epics
    .map((e) => {
      const categories = epicCategories
        .filter((c) => c.epicId === e.id)
        .map((c) => `${c.category}: ${c.keywords.join(', ')}`)
        .join('; ');
      // Use enriched description if epic description is short and enriched version exists
      const effectiveDescription =
        e.description.length < 50 && enrichedDescriptions?.has(e.id)
          ? enrichedDescriptions.get(e.id)!
          : e.description;
      return `- ${e.key}: ${e.name} - ${effectiveDescription}${categories ? ` [Categories: ${categories}]` : ''}`;
    })
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Ticket:
Title: ${ticket.title}
Description: ${ticket.description}
Type: ${ticket.ticketType}

Available Epics:
${epicInfo}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return createNewEpicProposal(ticket);
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText);

    if (result.type === 'match' && result.epicKey) {
      const matchedEpic = epics.find((e) => e.key === result.epicKey);
      return {
        type: 'match',
        epicId: matchedEpic?.id,
        confidence: Number(result.confidence) || 0.5,
        reasoning: String(result.reasoning || ''),
      };
    } else {
      return {
        type: 'create',
        confidence: Number(result.confidence) || 0.5,
        reasoning: String(result.reasoning || ''),
        newEpicProposal: result.newEpicProposal
          ? {
              name: String(result.newEpicProposal.name || ''),
              key: String(result.newEpicProposal.key || ''),
              description: String(result.newEpicProposal.description || ''),
            }
          : undefined,
      };
    }
  } catch (error) {
    console.error('Failed to parse epic suggestion response:', content.text);
    return createNewEpicProposal(ticket);
  }
}

function createNewEpicProposal(ticket: { title: string; description: string }): EpicSuggestion {
  // Generate a simple epic proposal when AI fails or no epics exist
  const keySlug = ticket.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 20);

  return {
    type: 'create',
    confidence: 0.5,
    reasoning: 'No existing epics available for matching',
    newEpicProposal: {
      name: ticket.title.slice(0, 50),
      key: keySlug,
      description: `Epic for tickets related to: ${ticket.title}`,
    },
  };
}

/**
 * Infer the technical skills required to complete a ticket
 * Analyzes ticket content to extract required skills for better matching
 */
export async function inferRequiredSkills(ticket: {
  title: string;
  description: string;
  ticketType: string;
}): Promise<string[]> {
  const systemPrompt = `You are analyzing a JIRA ticket to identify the technical skills required to complete it.
Based on the ticket title, description, and type, identify what skills would be needed.

Focus on technical skills like:
- Programming languages (TypeScript, Python, Java, etc.)
- Frameworks (React, Node.js, Express, etc.)
- Domains (Authentication, API design, Database, UI/UX, etc.)
- Tools (AWS, Docker, Kubernetes, etc.)
- Concepts (Testing, Performance optimization, Security, etc.)

Response format (JSON array of skill names):
["React", "TypeScript", "API design"]

Only include skills that are clearly needed based on the content. Be conservative - only list skills where there's clear evidence in the ticket.
Only return the JSON array, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Ticket:
Title: ${ticket.title}
Description: ${ticket.description}
Type: ${ticket.ticketType}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return [];
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const skills = JSON.parse(jsonText);
    return Array.isArray(skills) ? skills.map(String).filter((s) => s.length > 0) : [];
  } catch (error) {
    console.error('Failed to parse required skills response:', content.text);
    return [];
  }
}

/**
 * Generate an enriched description for an epic based on its child tickets
 * Used when epic descriptions are empty or minimal
 */
export async function generateEpicDescription(
  epicName: string,
  childTickets: { summary: string; description: string }[]
): Promise<string> {
  if (childTickets.length === 0) {
    return '';
  }

  const systemPrompt = `You are analyzing child tickets of a JIRA epic to generate a meaningful description.
Based on the tickets, understand what the epic covers and summarize it.

Write a 2-3 sentence description that captures:
- The domain/area this epic covers
- The main features or capabilities being developed
- The technical scope (if apparent from the tickets)

Be concise and informative. The description should help someone quickly understand what this epic is about.
Only return the description text, no other text or formatting.`;

  const ticketSummaries = childTickets
    .slice(0, 15)
    .map((t) => `- ${t.summary}${t.description ? `: ${t.description.slice(0, 100)}` : ''}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Epic name: ${epicName}

Child tickets (${childTickets.length} total):
${ticketSummaries}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return '';
  }

  return content.text.trim();
}

/**
 * Suggest assignees for a ticket based on skills and past work
 */
export async function suggestAssigneesForTicket(
  ticket: { title: string; description: string; ticketType: string; requiredSkills?: string[] },
  teamMembers: TeamMember[],
  inferredSkills: InferredSkill[]
): Promise<AssigneeSuggestion[]> {
  if (teamMembers.length === 0) {
    return [];
  }

  const hasRequiredSkills = ticket.requiredSkills && ticket.requiredSkills.length > 0;

  const systemPrompt = `You are matching a JIRA ticket to the best team members based on their skills.
Rank team members by fit and provide confidence scores.

${
  hasRequiredSkills
    ? `IMPORTANT: This ticket has REQUIRED SKILLS listed. Team members who have these skills should receive significantly higher confidence scores. A team member with all required skills should get 0.8+ confidence. Missing required skills should substantially reduce confidence.`
    : `Analyze the ticket content to understand what skills would be needed, then match against team member skills.`
}

Response format (JSON array):
[
  {
    "teamMemberId": "uuid-here",
    "confidence": 0.9,
    "reasoning": "Strong TypeScript and React skills match this frontend ticket",
    "matchedSkills": ["TypeScript", "React"]
  }
]

Confidence scoring guidelines:
- 0.8+: Team member has most/all required skills and relevant experience
- 0.6-0.8: Team member has some required skills or strong domain overlap
- 0.4-0.6: Partial match, may need support or learning
- <0.4: Poor match, missing key skills

Only include team members with confidence >= 0.3. Return up to 3 suggestions.
Only return the JSON array, no other text.`;

  const memberInfo = teamMembers
    .map((m) => {
      const skills = inferredSkills
        .filter((s) => s.teamMemberId === m.id)
        .map((s) => `${s.skill} (${(s.confidence * 100).toFixed(0)}%)`)
        .join(', ');
      const definedSkills = m.skills.length > 0 ? m.skills.join(', ') : 'None defined';
      return `- ${m.id}: ${m.name} (${m.role})
    Defined skills: ${definedSkills}
    Inferred skills: ${skills || 'None inferred'}`;
    })
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Ticket:
Title: ${ticket.title}
Description: ${ticket.description}
Type: ${ticket.ticketType}
${ticket.requiredSkills?.length ? `Required skills: ${ticket.requiredSkills.join(', ')}` : ''}

Team Members:
${memberInfo}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return [];
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const suggestions = JSON.parse(jsonText);
    return Array.isArray(suggestions)
      ? suggestions
          .map((s: any) => ({
            teamMemberId: String(s.teamMemberId || ''),
            confidence: Number(s.confidence) || 0.5,
            reasoning: String(s.reasoning || ''),
            matchedSkills: Array.isArray(s.matchedSkills) ? s.matchedSkills.map(String) : [],
          }))
          .filter((s) => teamMembers.some((m) => m.id === s.teamMemberId))
      : [];
  } catch (error) {
    console.error('Failed to parse assignee suggestion response:', content.text);
    return [];
  }
}

// ============================================================================
// Ideas Feature - Brainstorming & PRD Generation
// ============================================================================

/**
 * Brainstorm with the user about their idea
 * Acts as a PM/architect helping refine the idea
 */
export async function brainstormIdea(
  messages: IdeaMessage[],
  currentPRD: IdeaPRD | null,
  context?: BrainstormContext
): Promise<BrainstormResponse> {
  const prdContext = currentPRD
    ? `

CURRENT PRD (Blueprint):
Title: ${currentPRD.title}
Problem: ${currentPRD.problemStatement}
Goals: ${currentPRD.goals.join(', ')}
User Stories: ${currentPRD.userStories.length} defined
Requirements: ${currentPRD.functionalRequirements.length} functional, NFRs defined
`
    : '';

  // Build project context section if available
  let projectContextSection = '';
  if (context?.projectContext && context.projectContext.projectName) {
    const pc = context.projectContext;
    projectContextSection = `
=== PROJECT CONTEXT ===
Project: ${pc.projectName}
${pc.description}

${pc.techStack ? `Tech Stack: ${pc.techStack}` : ''}
${pc.architecture ? `Architecture: ${pc.architecture}` : ''}
${pc.productAreas ? `Key Product Areas: ${pc.productAreas}` : ''}
${pc.conventions ? `Conventions: ${pc.conventions}` : ''}
${pc.additionalContext ? `Additional Context: ${pc.additionalContext}` : ''}
`;
  }

  // Build team context section
  let teamContextSection = '';
  if (context?.teamMembers && context.teamMembers.length > 0) {
    const teamInfo = context.teamMembers
      .map((m) => `- ${m.name} (${m.role}): ${m.skills.join(', ')}`)
      .join('\n');
    teamContextSection = `
=== CURRENT TEAM ===
${teamInfo}
`;
  }

  // Build epics context section
  let epicsContextSection = '';
  if (context?.epics && context.epics.length > 0) {
    const epicsInfo = context.epics
      .map((e) => `- ${e.name}: ${e.description}`)
      .join('\n');
    epicsContextSection = `
=== ACTIVE CAMPAIGNS (Epics) ===
${epicsInfo}
`;
  }

  // Build recent tickets section
  let ticketsContextSection = '';
  if (context?.recentTickets && context.recentTickets.length > 0) {
    const ticketsInfo = context.recentTickets
      .slice(0, 15)
      .map((t) => `- [${t.priority}] ${t.title}`)
      .join('\n');
    ticketsContextSection = `
=== RECENT WORK (Last ${Math.min(context.recentTickets.length, 15)} tickets) ===
${ticketsInfo}
`;
  }

  // Combine all context sections
  const fullContextSection = projectContextSection || teamContextSection || epicsContextSection || ticketsContextSection
    ? `${projectContextSection}${teamContextSection}${epicsContextSection}${ticketsContextSection}
---
When brainstorming, consider how this idea fits with the existing product, team capabilities, and current work in progress.

`
    : '';

  const systemPrompt = `${fullContextSection}You are an experienced Product Manager and Software Architect helping brainstorm and refine product ideas. Your role is to:

1. Ask clarifying questions to understand the problem space
2. Identify potential challenges and edge cases
3. Suggest scope boundaries (what to include/exclude)
4. Help prioritize features
5. Consider technical implications
6. Guide toward a clear, implementable solution

Communication style:
- Be conversational and collaborative
- Ask focused questions (1-2 at a time, not overwhelming lists)
- Share relevant insights from software development experience
- Be encouraging but also challenge assumptions constructively
- Use simple, clear language

${prdContext ? `The user has already generated a PRD. You can reference it and discuss modifications.${prdContext}` : ''}

After 3-4 meaningful exchanges, if the idea seems well-defined, hint that the user might be ready to generate a PRD (Blueprint).

Response format (JSON):
{
  "message": "Your response to the user",
  "thinkingSteps": ["Step 1 of your reasoning", "Step 2..."],  // Optional, for complex analysis
  "suggestPRD": false  // Set to true if the idea seems ready for PRD generation
}

Only return the JSON, no other text.`;

  const conversationHistory = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return { message: 'I encountered an error processing your message. Please try again.' };
  }

  try {
    const result = parseJsonResponse(content.text);
    return {
      message: String(result.message || ''),
      thinkingSteps: Array.isArray(result.thinkingSteps) ? result.thinkingSteps.map(String) : undefined,
      suggestPRD: Boolean(result.suggestPRD),
    };
  } catch (error) {
    // If JSON parsing fails, return the raw text as the message
    return { message: content.text.trim() };
  }
}

/**
 * Generate a PRD from the conversation history
 */
export async function generatePRDFromConversation(
  messages: IdeaMessage[],
  sessionTitle: string
): Promise<PRDGenerationResponse> {
  const systemPrompt = `You are a Product Manager creating a comprehensive PRD (Product Requirements Document) from a brainstorming conversation.

Extract and organize the following from the conversation:
1. Problem Statement - What problem are we solving and why it matters
2. Goals - 3-5 specific, measurable objectives
3. User Stories - 5-10 user stories in "As a [user], I want [feature] so that [benefit]" format
4. Functional Requirements - Specific features and behaviors
5. Non-Functional Requirements - Performance, security, scalability needs
6. Success Metrics - How we'll measure success
7. Scope Boundaries - What's in scope vs out of scope
8. Technical Considerations - Architecture notes, constraints, dependencies

Response format (JSON):
{
  "prd": {
    "title": "Feature/Product Name",
    "problemStatement": "Clear problem description...",
    "goals": ["Goal 1", "Goal 2", "Goal 3"],
    "userStories": ["As a user, I want...", "As an admin, I want..."],
    "functionalRequirements": ["Requirement 1", "Requirement 2"],
    "nonFunctionalRequirements": "Performance targets, security requirements, etc.",
    "successMetrics": "KPIs and metrics to track...",
    "scopeBoundaries": {
      "inScope": ["Feature A", "Feature B"],
      "outOfScope": ["Future consideration X", "Not included Y"]
    },
    "technicalConsiderations": "Architecture notes, tech stack considerations...",
    "rawContent": "# Full PRD as Markdown\\n\\n## Problem Statement\\n..."
  },
  "summary": "Brief summary of what was captured in the PRD"
}

The rawContent should be a complete, well-formatted Markdown document suitable for Confluence.

Only return the JSON, no other text.`;

  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Session: "${sessionTitle}"\n\nConversation:\n${conversationText}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  // Generate rawContent if not provided
  const prd = result.prd;
  if (!prd.rawContent) {
    prd.rawContent = generatePRDMarkdown(prd);
  }

  return {
    prd: {
      sessionId: '', // Will be set by caller
      title: String(prd.title || sessionTitle),
      problemStatement: String(prd.problemStatement || ''),
      goals: Array.isArray(prd.goals) ? prd.goals.map(String) : [],
      userStories: Array.isArray(prd.userStories) ? prd.userStories.map(String) : [],
      functionalRequirements: Array.isArray(prd.functionalRequirements) ? prd.functionalRequirements.map(String) : [],
      nonFunctionalRequirements: String(prd.nonFunctionalRequirements || ''),
      successMetrics: String(prd.successMetrics || ''),
      scopeBoundaries: {
        inScope: Array.isArray(prd.scopeBoundaries?.inScope) ? prd.scopeBoundaries.inScope.map(String) : [],
        outOfScope: Array.isArray(prd.scopeBoundaries?.outOfScope) ? prd.scopeBoundaries.outOfScope.map(String) : [],
      },
      technicalConsiderations: prd.technicalConsiderations ? String(prd.technicalConsiderations) : undefined,
      rawContent: String(prd.rawContent),
    },
    summary: String(result.summary || 'PRD generated successfully'),
  };
}

/**
 * Parse an existing PRD from raw markdown content
 */
export async function parsePRDFromMarkdown(
  rawMarkdown: string
): Promise<PRDGenerationResponse> {
  const systemPrompt = `You are a Product Manager parsing an existing PRD (Product Requirements Document) from markdown content.

Parse and extract the following structured fields from the PRD:
1. Problem Statement - What problem is being solved and why it matters
2. Goals - 3-5 specific, measurable objectives
3. User Stories - User stories in "As a [user], I want [feature] so that [benefit]" format
4. Functional Requirements - Specific features and behaviors
5. Non-Functional Requirements - Performance, security, scalability needs
6. Success Metrics - How success will be measured
7. Scope Boundaries - What's in scope vs out of scope
8. Technical Considerations - Architecture notes, constraints, dependencies

Response format (JSON):
{
  "prd": {
    "title": "Feature/Product Name",
    "problemStatement": "Clear problem description...",
    "goals": ["Goal 1", "Goal 2", "Goal 3"],
    "userStories": ["As a user, I want...", "As an admin, I want..."],
    "functionalRequirements": ["Requirement 1", "Requirement 2"],
    "nonFunctionalRequirements": "Performance targets, security requirements, etc.",
    "successMetrics": "KPIs and metrics to track...",
    "scopeBoundaries": {
      "inScope": ["Feature A", "Feature B"],
      "outOfScope": ["Future consideration X", "Not included Y"]
    },
    "technicalConsiderations": "Architecture notes, tech stack considerations..."
  },
  "summary": "Brief summary of what was captured in the PRD"
}

Only return the JSON, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: rawMarkdown,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  const prd = result.prd;

  return {
    prd: {
      sessionId: '', // Will be set by caller
      title: String(prd.title || 'Imported PRD'),
      problemStatement: String(prd.problemStatement || ''),
      goals: Array.isArray(prd.goals) ? prd.goals.map(String) : [],
      userStories: Array.isArray(prd.userStories) ? prd.userStories.map(String) : [],
      functionalRequirements: Array.isArray(prd.functionalRequirements) ? prd.functionalRequirements.map(String) : [],
      nonFunctionalRequirements: String(prd.nonFunctionalRequirements || ''),
      successMetrics: String(prd.successMetrics || ''),
      scopeBoundaries: {
        inScope: Array.isArray(prd.scopeBoundaries?.inScope) ? prd.scopeBoundaries.inScope.map(String) : [],
        outOfScope: Array.isArray(prd.scopeBoundaries?.outOfScope) ? prd.scopeBoundaries.outOfScope.map(String) : [],
      },
      technicalConsiderations: prd.technicalConsiderations ? String(prd.technicalConsiderations) : undefined,
      rawContent: rawMarkdown,
    },
    summary: String(result.summary || 'PRD parsed successfully'),
  };
}

/**
 * Update an existing PRD based on a user's change request
 */
export async function updatePRDFromChat(
  currentPRD: IdeaPRD,
  userRequest: string
): Promise<PRDUpdateResponse> {
  const systemPrompt = `You are updating an existing PRD based on a user's change request.

Current PRD:
- Title: ${currentPRD.title}
- Problem: ${currentPRD.problemStatement}
- Goals: ${currentPRD.goals.join('; ')}
- User Stories: ${currentPRD.userStories.join('; ')}
- Functional Requirements: ${currentPRD.functionalRequirements.join('; ')}
- Non-Functional Requirements: ${currentPRD.nonFunctionalRequirements}
- Success Metrics: ${currentPRD.successMetrics}
- In Scope: ${currentPRD.scopeBoundaries.inScope.join(', ')}
- Out of Scope: ${currentPRD.scopeBoundaries.outOfScope.join(', ')}
- Technical: ${currentPRD.technicalConsiderations || 'None'}

Intelligently update ONLY the sections affected by the user's request. Preserve unchanged content.

Response format (JSON):
{
  "prd": {
    // Only include fields that changed
    "userStories": ["Updated stories..."],  // Example if user stories changed
    "rawContent": "# Updated full markdown..."  // Always regenerate this
  },
  "changeSummary": "Added user story about admin export functionality"
}

Only return the JSON, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `User's change request: "${userRequest}"`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  return {
    prd: result.prd || {},
    changeSummary: String(result.changeSummary || 'PRD updated'),
  };
}

/**
 * Split a PRD into individual ticket proposals
 */
export async function splitPRDIntoTickets(
  prd: IdeaPRD,
  teamMembers: TeamMember[],
  epics: Epic[],
  inferredSkills: InferredSkill[],
  codebaseContext?: { contextSummary: string } | null
): Promise<TicketSplitResponse> {
  const teamInfo = teamMembers
    .map((m) => {
      const skills = inferredSkills
        .filter((s) => s.teamMemberId === m.id)
        .map((s) => s.skill)
        .join(', ');
      return `- ${m.id}: ${m.name} (${m.role}) - Skills: ${m.skills.join(', ')}${skills ? `, Inferred: ${skills}` : ''}`;
    })
    .join('\n');

  const epicInfo = epics.map((e) => `- ${e.id}: ${e.name} - ${e.description}`).join('\n');

  const codebaseSection = codebaseContext ? `\n\nCodebase Context:\nUse this to reference specific files/directories, identify existing modules to modify, suggest accurate file paths, and scope tickets based on actual architecture.\n\n${codebaseContext.contextSummary}` : '';

  const systemPrompt = `You are splitting a PRD into implementable tickets/tasks.

Guidelines:
1. Create separate tickets for Frontend, Backend, Design when warranted
2. Each ticket should be 3-5 story points (completable in 1-3 days)
3. Write clear acceptance criteria (3-5 per ticket)
4. Identify required skills for each ticket
5. Suggest the best assignee based on skills (with confidence score)
6. Link related tickets with the same featureGroupId
7. Consider dependencies between tickets

Layers:
- frontend: UI components, client-side logic
- backend: API endpoints, server logic, database
- design: UX research, mockups, prototypes
- fullstack: Work spanning FE and BE
- infrastructure: DevOps, CI/CD, deployment
- data: Data pipelines, analytics, ML

PRD to split:
Title: ${prd.title}
Problem: ${prd.problemStatement}
Goals: ${prd.goals.join('; ')}
User Stories: ${prd.userStories.join('; ')}
Requirements: ${prd.functionalRequirements.join('; ')}
Technical: ${prd.technicalConsiderations || 'None specified'}

Team Members:
${teamInfo || 'None configured'}

Available Epics:
${epicInfo || 'None configured'}${codebaseSection}

Response format (JSON):
{
  "proposals": [
    {
      "title": "User Auth - Backend API",
      "description": "Implement authentication API endpoints...",
      "acceptanceCriteria": ["AC 1", "AC 2", "AC 3"],
      "ticketType": "feature",
      "priority": "high",
      "layer": "backend",
      "requiredSkills": ["Node.js", "Authentication"],
      "suggestedAssigneeId": "uuid-or-null",
      "suggestedEpicId": "uuid-or-null",
      "assignmentConfidence": 0.85,
      "assignmentReasoning": "Strong backend skills and auth experience",
      "featureGroupId": "user-auth",
      "affectedFiles": ["src/services/authService.ts"],
      "implementationHints": "Modify the existing UserController..."
    }
  ],
  "summary": "Created 5 tickets: 2 backend, 2 frontend, 1 design"
}

Only return the JSON, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Please split this PRD into implementable tickets.',
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  // Convert featureGroupId slugs to UUIDs
  const featureGroupMap = new Map<string, string>();
  const proposals = (result.proposals || []).map((p: any) => {
    let featureGroupId: string | undefined;
    if (p.featureGroupId) {
      if (!featureGroupMap.has(p.featureGroupId)) {
        featureGroupMap.set(p.featureGroupId, uuidv4());
      }
      featureGroupId = featureGroupMap.get(p.featureGroupId);
    }

    return {
      title: String(p.title || ''),
      description: String(p.description || ''),
      acceptanceCriteria: Array.isArray(p.acceptanceCriteria) ? p.acceptanceCriteria.map(String) : [],
      ticketType: String(p.ticketType || 'task'),
      priority: String(p.priority || 'medium'),
      layer: validateLayer(p.layer),
      requiredSkills: Array.isArray(p.requiredSkills) ? p.requiredSkills.map(String) : [],
      suggestedAssigneeId: resolveAssigneeId(p.suggestedAssigneeId, teamMembers),
      suggestedEpicId: resolveEpicId(p.suggestedEpicId, epics),
      assignmentConfidence: Number(p.assignmentConfidence) || 0,
      assignmentReasoning: p.assignmentReasoning ? String(p.assignmentReasoning) : undefined,
      featureGroupId,
      affectedFiles: Array.isArray(p.affectedFiles) ? p.affectedFiles.map(String) : undefined,
      implementationHints: p.implementationHints ? String(p.implementationHints) : undefined,
    };
  });

  return {
    proposals,
    summary: String(result.summary || `Created ${proposals.length} tickets`),
  };
}

/**
 * Update ticket proposals based on user's chat request
 */
export async function updateTicketsFromChat(
  proposals: IdeaTicketProposal[],
  userRequest: string
): Promise<TicketUpdateResponse> {
  const proposalsInfo = proposals
    .map((p, i) => `${i + 1}. [${p.id}] ${p.title} (${p.layer}, ${p.priority}) - ${p.status}`)
    .join('\n');

  const systemPrompt = `You are updating ticket proposals based on a user's request.

Current proposals:
${proposalsInfo}

The user may reference tickets by:
- Number (e.g., "ticket 3")
- Title (e.g., "the auth ticket")
- Description content

Respond with updates to apply. Only include proposals that need changes.

Response format (JSON):
{
  "updates": [
    {
      "proposalId": "uuid-of-proposal",
      "changes": {
        "priority": "high",  // Only include fields that changed
        "title": "Updated title"
      }
    }
  ],
  "changeSummary": "Changed priority of ticket 3 to high"
}

Only return the JSON, no other text.`;

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userRequest,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  return {
    updates: Array.isArray(result.updates)
      ? result.updates.map((u: any) => ({
          proposalId: String(u.proposalId || ''),
          changes: u.changes || {},
        }))
      : [],
    changeSummary: String(result.changeSummary || 'Tickets updated'),
  };
}

// Helper functions for Ideas feature

function parseJsonResponse(text: string): any {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();
  return JSON.parse(jsonText);
}

function validateLayer(layer: string): 'frontend' | 'backend' | 'design' | 'fullstack' | 'infrastructure' | 'data' {
  const validLayers = ['frontend', 'backend', 'design', 'fullstack', 'infrastructure', 'data'] as const;
  return validLayers.includes(layer as any) ? (layer as any) : 'fullstack';
}

function resolveAssigneeId(id: string | null | undefined, teamMembers: TeamMember[]): string | undefined {
  if (!id) return undefined;
  const member = teamMembers.find((m) => m.id === id || m.name.toLowerCase() === id.toLowerCase());
  return member?.id;
}

function resolveEpicId(id: string | null | undefined, epics: Epic[]): string | undefined {
  if (!id) return undefined;
  const epic = epics.find((e) => e.id === id || e.key === id);
  return epic?.id;
}

function generatePRDMarkdown(prd: any): string {
  return `# ${prd.title || 'Product Requirements Document'}

## Problem Statement
${prd.problemStatement || 'To be defined'}

## Goals
${(prd.goals || []).map((g: string) => `- ${g}`).join('\n') || '- To be defined'}

## User Stories
${(prd.userStories || []).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || '1. To be defined'}

## Functional Requirements
${(prd.functionalRequirements || []).map((r: string) => `- [ ] ${r}`).join('\n') || '- [ ] To be defined'}

## Non-Functional Requirements
${prd.nonFunctionalRequirements || 'To be defined'}

## Success Metrics
${prd.successMetrics || 'To be defined'}

## Scope

### In Scope
${(prd.scopeBoundaries?.inScope || []).map((s: string) => `- ${s}`).join('\n') || '- To be defined'}

### Out of Scope
${(prd.scopeBoundaries?.outOfScope || []).map((s: string) => `- ${s}`).join('\n') || '- To be defined'}

## Technical Considerations
${prd.technicalConsiderations || 'To be defined'}

---
*Generated from Idea Forge*
*Created: ${new Date().toISOString().split('T')[0]}*
`;
}

// ============================================================================
// Design Prototyping Feature
// ============================================================================

export interface DesignConversationContext {
  currentPrototype?: string;
  sourceDetails?: string;
  codebaseContext?: string;
}

export interface DesignPrototypeContext {
  sessionTitle: string;
  conversationSummary: string;
  sourceDetails?: string;
  codebaseContext?: string;
}

/**
 * Carry on a design conversation with the user
 */
export async function designConversation(
  messages: { role: string; content: string }[],
  context: DesignConversationContext
): Promise<{ message: string }> {
  const { currentPrototype, sourceDetails, codebaseContext } = context;

  const systemPrompt = `You are a senior product designer working with a development team.
You have access to the following context:

${sourceDetails ? `Source Context:\n${sourceDetails}\n` : ''}
${codebaseContext ? `Codebase & Design System:\n${codebaseContext}\n` : ''}
${currentPrototype ? `Current Prototype:\n\`\`\`tsx\n${currentPrototype}\n\`\`\`\n` : ''}

Help the user think through the design. Ask clarifying questions about user flows, edge cases, and visual hierarchy. When ready or when asked, generate a production-quality React component using Tailwind CSS.

When generating or updating a component, output it in a single \`\`\`tsx code block. The component should:
- Be a self-contained functional component with no external dependencies beyond React + Tailwind
- Use modern React patterns (hooks, composition)
- Be responsive (mobile-first)
- Use proper semantic HTML and accessibility
- Include realistic placeholder data
- Export as default`;

  const conversationHistory = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const response = await callClaudeWithRetry({
    max_tokens: 8192,
    system: systemPrompt,
    messages: conversationHistory,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return { message: 'I encountered an error processing your message. Please try again.' };
  }

  return { message: content.text.trim() };
}

/**
 * Generate a full design prototype from conversation context
 */
export async function generateDesignPrototype(
  context: DesignPrototypeContext
): Promise<{ name: string; description: string; componentCode: string }> {
  const { sessionTitle, conversationSummary, sourceDetails, codebaseContext } = context;

  const systemPrompt = `Generate a production-quality React component with Tailwind CSS.

Context:
- Design: ${sessionTitle}
- Conversation: ${conversationSummary}
${sourceDetails ? `- Source: ${sourceDetails}` : ''}
${codebaseContext ? `- Codebase patterns: ${codebaseContext}` : ''}

Requirements:
- Self-contained functional component (no external dependencies beyond React + Tailwind)
- Modern React patterns (hooks, composition)
- Responsive design (mobile-first)
- Proper semantic HTML and accessibility (aria labels, keyboard nav)
- Include realistic placeholder data
- Export as default component

Respond with a JSON object: { "name": "ComponentName", "description": "Brief description", "code": "...full component code..." }`;

  const response = await callClaudeWithRetry({
    max_tokens: 16384,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Generate the prototype component based on our conversation.',
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const result = parseJsonResponse(content.text);

  return {
    name: String(result.name || 'DesignPrototype'),
    description: String(result.description || ''),
    componentCode: String(result.code || ''),
  };
}
