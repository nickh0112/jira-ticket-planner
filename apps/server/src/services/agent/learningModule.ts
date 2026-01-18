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
  const recentTickets = await jiraService.getRecentTickets(config, { maxResults: 200 });
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
  for (const ticket of recentTickets) {
    if (ticket.epicKey) {
      const existing = ticketsByEpic.get(ticket.epicKey) || [];
      existing.push(ticket);
      ticketsByEpic.set(ticket.epicKey, existing);
    }
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
