import { v4 as uuidv4 } from 'uuid';
import type { createStorageService } from '../storageService.js';
import type { JiraService } from '../jiraService.js';
import type { JiraConfig, LearningResult, InferredSkill, EpicCategory } from '@jira-planner/shared';
import { inferSkillsFromTickets, categorizeEpic } from '../claudeService.js';

interface LearningContext {
  storage: ReturnType<typeof createStorageService>;
  jiraService: JiraService;
  config: JiraConfig;
}

/**
 * Learn from Jira ticket history to build knowledge base
 * Analyzes assignment patterns, ticket quality patterns, and epic taxonomy
 */
export async function learnFromJiraHistory(context: LearningContext): Promise<LearningResult> {
  const { storage, jiraService, config } = context;

  const result: LearningResult = {
    ticketsAnalyzed: 0,
    patternsLearned: 0,
    skillsInferred: [],
    epicCategories: [],
  };

  // Step 1: Fetch recent tickets from Jira
  console.log('Fetching recent tickets from Jira...');
  const recentTickets = await jiraService.getRecentTickets(config, { maxResults: 500 });
  result.ticketsAnalyzed = recentTickets.length;
  console.log(`Fetched ${recentTickets.length} tickets`);

  // Step 2: Analyze assignee patterns and infer skills
  console.log('Analyzing team member skills...');
  const teamMembers = storage.getTeamMembers();
  const skillsToSave: Omit<InferredSkill, 'lastUpdated'>[] = [];

  // Group tickets by assignee
  const ticketsByAssignee = new Map<string, typeof recentTickets>();
  for (const ticket of recentTickets) {
    if (ticket.assignee) {
      const existing = ticketsByAssignee.get(ticket.assignee.accountId) || [];
      existing.push(ticket);
      ticketsByAssignee.set(ticket.assignee.accountId, existing);
    }
  }

  // Match Jira users to team members and infer skills
  for (const member of teamMembers) {
    if (!member.jiraUsername) continue;

    // Find tickets assigned to this member (match by display name since we sync that)
    let memberTickets: typeof recentTickets = [];
    for (const [, tickets] of ticketsByAssignee) {
      if (tickets[0]?.assignee?.displayName === member.name) {
        memberTickets = tickets;
        break;
      }
    }

    if (memberTickets.length === 0) continue;

    // Use AI to infer skills from completed tickets
    const inferredSkills = await inferSkillsFromTickets(member.id, member.name, memberTickets);

    const memberSkills: string[] = [];
    for (const skill of inferredSkills) {
      skillsToSave.push({
        id: uuidv4(),
        teamMemberId: member.id,
        skill: skill.skill,
        confidence: skill.confidence,
        evidence: skill.evidence,
      });
      memberSkills.push(skill.skill);
    }

    if (memberSkills.length > 0) {
      result.skillsInferred.push({
        teamMemberId: member.id,
        skills: memberSkills,
      });
    }
  }

  // Save all inferred skills
  if (skillsToSave.length > 0) {
    storage.clearInferredSkills(); // Clear old skills
    storage.saveInferredSkills(skillsToSave);
    result.patternsLearned += skillsToSave.length;
  }
  console.log(`Inferred ${skillsToSave.length} skills for ${result.skillsInferred.length} team members`);

  // Step 3: Analyze epic patterns and categorize
  console.log('Categorizing epics...');
  const epics = storage.getEpics();
  const epicCategoriesToSave: Omit<EpicCategory, 'lastUpdated'>[] = [];

  // Group tickets by epic
  const ticketsByEpic = new Map<string, typeof recentTickets>();
  let ticketsWithEpic = 0;
  for (const ticket of recentTickets) {
    if (ticket.epicKey) {
      ticketsWithEpic++;
      const existing = ticketsByEpic.get(ticket.epicKey) || [];
      existing.push(ticket);
      ticketsByEpic.set(ticket.epicKey, existing);
    }
  }
  console.log(`Found ${ticketsWithEpic} tickets with epic keys, grouped into ${ticketsByEpic.size} unique epics`);
  console.log(`Local database has ${epics.length} epics`);
  if (ticketsByEpic.size > 0) {
    console.log('Epic keys from Jira tickets:', Array.from(ticketsByEpic.keys()).slice(0, 10).join(', '));
    console.log('Epic keys in local DB:', epics.slice(0, 10).map(e => e.key).join(', '));
  }

  for (const epic of epics) {
    const epicTickets = ticketsByEpic.get(epic.key) || [];
    if (epicTickets.length === 0) continue;

    // Use AI to categorize the epic based on its tickets
    const categories = await categorizeEpic(epic.key, epic.name, epicTickets);

    const epicCats: string[] = [];
    for (const category of categories) {
      epicCategoriesToSave.push({
        id: uuidv4(),
        epicId: epic.id,
        category: category.category,
        keywords: category.keywords,
      });
      epicCats.push(category.category);
    }

    if (epicCats.length > 0) {
      result.epicCategories.push({
        epicId: epic.id,
        categories: epicCats,
      });
    }
  }

  // Save all epic categories
  if (epicCategoriesToSave.length > 0) {
    storage.clearEpicCategories(); // Clear old categories
    storage.saveEpicCategories(epicCategoriesToSave);
    result.patternsLearned += epicCategoriesToSave.length;
  }
  console.log(`Categorized ${result.epicCategories.length} epics with ${epicCategoriesToSave.length} categories`);

  // Step 3b: Learn ticket-epic relationship patterns
  console.log('Learning ticket-epic relationship patterns...');
  for (const epic of epics) {
    const epicTickets = ticketsByEpic.get(epic.key) || [];
    if (epicTickets.length === 0) continue;

    // Learn ticket type distribution for this epic
    const typeDistribution = analyzeTicketTypeDistribution(epicTickets);
    storage.saveAgentKnowledge({
      id: `epic-ticket-types-${epic.id}`,
      knowledgeType: 'assignment_pattern',
      key: `epic-${epic.id}-ticket-types`,
      value: JSON.stringify(typeDistribution),
      confidence: Math.min(0.5 + epicTickets.length * 0.02, 0.95), // Higher confidence with more tickets
    });
    result.patternsLearned++;

    // Learn common title keywords for this epic
    const commonKeywords = extractCommonKeywords(epicTickets.map(t => t.summary));
    if (commonKeywords.length > 0) {
      storage.saveAgentKnowledge({
        id: `epic-keywords-${epic.id}`,
        knowledgeType: 'assignment_pattern',
        key: `epic-${epic.id}-keywords`,
        value: JSON.stringify(commonKeywords),
        confidence: 0.7,
      });
      result.patternsLearned++;
    }

    // Learn typical ticket count and velocity for this epic
    storage.saveAgentKnowledge({
      id: `epic-stats-${epic.id}`,
      knowledgeType: 'assignment_pattern',
      key: `epic-${epic.id}-stats`,
      value: JSON.stringify({
        totalTickets: epicTickets.length,
        avgDescriptionLength: Math.round(
          epicTickets.reduce((sum, t) => sum + t.description.length, 0) / epicTickets.length
        ),
      }),
      confidence: 0.8,
    });
    result.patternsLearned++;
  }
  console.log('Ticket-epic relationship patterns learned');

  // Step 4: Learn field patterns (description length, AC count, etc.)
  console.log('Analyzing field patterns...');
  const fieldPatterns = analyzeFieldPatterns(recentTickets);
  for (const [key, value] of Object.entries(fieldPatterns)) {
    storage.saveAgentKnowledge({
      id: `field-pattern-${key}`,
      knowledgeType: 'field_pattern',
      key,
      value: JSON.stringify(value),
      confidence: 0.8,
    });
    result.patternsLearned++;
  }
  console.log('Field pattern analysis complete');

  console.log(`Learning complete: ${result.ticketsAnalyzed} tickets, ${result.patternsLearned} patterns`);
  return result;
}

/**
 * Analyze field patterns from tickets to understand quality standards
 */
function analyzeFieldPatterns(tickets: { summary: string; description: string }[]): Record<string, any> {
  const patterns: Record<string, any> = {};

  // Description length stats
  const descLengths = tickets.map((t) => t.description.length).filter((l) => l > 0);
  if (descLengths.length > 0) {
    patterns.descriptionLength = {
      min: Math.min(...descLengths),
      max: Math.max(...descLengths),
      avg: Math.round(descLengths.reduce((a, b) => a + b, 0) / descLengths.length),
      median: descLengths.sort((a, b) => a - b)[Math.floor(descLengths.length / 2)],
    };
  }

  // Title length stats
  const titleLengths = tickets.map((t) => t.summary.length);
  if (titleLengths.length > 0) {
    patterns.titleLength = {
      min: Math.min(...titleLengths),
      max: Math.max(...titleLengths),
      avg: Math.round(titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length),
    };
  }

  return patterns;
}

/**
 * Analyze ticket type distribution for an epic
 */
function analyzeTicketTypeDistribution(
  tickets: { issueType: string }[]
): Record<string, { count: number; percentage: number }> {
  const typeCounts: Record<string, number> = {};
  const total = tickets.length;

  for (const ticket of tickets) {
    const type = ticket.issueType.toLowerCase();
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const distribution: Record<string, { count: number; percentage: number }> = {};
  for (const [type, count] of Object.entries(typeCounts)) {
    distribution[type] = {
      count,
      percentage: Math.round((count / total) * 100),
    };
  }

  return distribution;
}

/**
 * Extract common keywords from ticket titles
 */
function extractCommonKeywords(titles: string[]): string[] {
  // Common words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'shall', 'can', 'need', 'dare', 'ought', 'used', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'add', 'update', 'fix', 'remove', 'create', 'implement', 'make', 'get', 'set',
  ]);

  const wordCounts: Record<string, number> = {};

  for (const title of titles) {
    // Split into words, normalize, and filter
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }

  // Return words that appear in at least 10% of titles, up to 15 keywords
  const minCount = Math.max(2, Math.floor(titles.length * 0.1));
  return Object.entries(wordCounts)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}
