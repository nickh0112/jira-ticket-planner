import Anthropic from '@anthropic-ai/sdk';
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
} from '@jira-planner/shared';
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

Available team members:
${teamMembersInfo || 'None configured'}

Available epics:
${epicsInfo || 'None configured'}

Respond with a JSON array of tickets. Each ticket should have:
- title: string (clear, concise)
- description: string (detailed explanation)
- acceptanceCriteria: string[] (specific, testable criteria)
- ticketType: "feature" | "bug" | "improvement" | "task"
- priority: "highest" | "high" | "medium" | "low" | "lowest"
- assigneeId: string | null (ID of suggested team member, or null)
- epicId: string | null (ID of suggested epic, or null)
- labels: string[] (relevant labels like "backend", "frontend", "api", etc.)

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

    const tickets = JSON.parse(jsonText) as CreateTicketInput[];

    // Validate the structure
    return tickets.map((ticket) => ({
      title: String(ticket.title || ''),
      description: String(ticket.description || ''),
      acceptanceCriteria: Array.isArray(ticket.acceptanceCriteria)
        ? ticket.acceptanceCriteria.map(String)
        : [],
      ticketType: validateTicketType(ticket.ticketType),
      priority: validatePriority(ticket.priority),
      assigneeId: ticket.assigneeId || null,
      epicId: ticket.epicId || null,
      labels: Array.isArray(ticket.labels) ? ticket.labels.map(String) : [],
    }));
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
 */
export async function suggestEpicForTicket(
  ticket: { title: string; description: string; ticketType: string },
  epics: Epic[],
  epicCategories: EpicCategory[]
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
      return `- ${e.key}: ${e.name} - ${e.description}${categories ? ` [Categories: ${categories}]` : ''}`;
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

  const systemPrompt = `You are matching a JIRA ticket to the best team members based on their skills.
Rank team members by fit and provide confidence scores.

Response format (JSON array):
[
  {
    "teamMemberId": "uuid-here",
    "confidence": 0.9,
    "reasoning": "Strong TypeScript and React skills match this frontend ticket",
    "matchedSkills": ["TypeScript", "React"]
  }
]

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
