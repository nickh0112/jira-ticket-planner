import type {
  Epic,
  TeamMember,
  InferredSkill,
  EpicCategory,
  EpicSuggestion,
  AssigneeSuggestion,
} from '@jira-planner/shared';
import { suggestEpicForTicket, suggestAssigneesForTicket } from '../claudeService.js';

interface EpicRoutingContext {
  epics: Epic[];
  epicCategories: EpicCategory[];
}

interface AssigneeRoutingContext {
  teamMembers: TeamMember[];
  inferredSkills: InferredSkill[];
}

/**
 * Suggest an epic for a ticket using semantic matching
 * Uses AI to match against existing epics or propose new ones
 */
export async function suggestEpic(
  ticket: { title: string; description: string; ticketType: string },
  context: EpicRoutingContext
): Promise<EpicSuggestion> {
  // If no epics exist, propose a new one
  if (context.epics.length === 0) {
    return createDefaultEpicProposal(ticket);
  }

  // Use AI to find the best match or suggest a new epic
  return suggestEpicForTicket(ticket, context.epics, context.epicCategories);
}

/**
 * Suggest assignees for a ticket based on skills matching
 */
export async function suggestAssignees(
  ticket: { title: string; description: string; ticketType: string; requiredSkills?: string[] },
  context: AssigneeRoutingContext
): Promise<AssigneeSuggestion[]> {
  // If no team members, return empty
  if (context.teamMembers.length === 0) {
    return [];
  }

  // Use AI to rank team members by fit
  return suggestAssigneesForTicket(ticket, context.teamMembers, context.inferredSkills);
}

/**
 * Create a default epic proposal when no epics exist
 */
function createDefaultEpicProposal(ticket: { title: string; description: string }): EpicSuggestion {
  const keySlug = ticket.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 20);

  return {
    type: 'create',
    confidence: 0.5,
    reasoning: 'No existing epics in the project. Proposing a new epic based on the ticket.',
    newEpicProposal: {
      name: extractEpicName(ticket.title),
      key: keySlug || 'new-epic',
      description: `Epic for work related to: ${ticket.title}`,
    },
  };
}

/**
 * Extract a suitable epic name from a ticket title
 */
function extractEpicName(title: string): string {
  // Remove common prefixes like "Add", "Implement", "Fix", "Update"
  const prefixes = /^(add|implement|fix|update|create|build|enable|support)\s+/i;
  let name = title.replace(prefixes, '');

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // Truncate if too long
  if (name.length > 50) {
    name = name.slice(0, 47) + '...';
  }

  return name;
}

/**
 * Calculate match score between a ticket and an epic based on keywords
 * Used as a fallback when AI is unavailable
 */
export function calculateKeywordMatchScore(
  ticket: { title: string; description: string },
  epic: Epic,
  epicCategories: EpicCategory[]
): number {
  const ticketText = `${ticket.title} ${ticket.description}`.toLowerCase();
  const epicText = `${epic.name} ${epic.description}`.toLowerCase();

  // Get keywords for this epic
  const epicKeywords = epicCategories
    .filter((c) => c.epicId === epic.id)
    .flatMap((c) => c.keywords)
    .map((k) => k.toLowerCase());

  let score = 0;
  let maxScore = 0;

  // Check direct word overlap between ticket and epic
  const epicWords = epicText.split(/\W+/).filter((w) => w.length > 3);
  for (const word of epicWords) {
    maxScore++;
    if (ticketText.includes(word)) {
      score++;
    }
  }

  // Check keyword matches (weighted higher)
  for (const keyword of epicKeywords) {
    maxScore += 2;
    if (ticketText.includes(keyword)) {
      score += 2;
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Calculate skill match score between a ticket and a team member
 * Used as a fallback when AI is unavailable
 */
export function calculateSkillMatchScore(
  ticket: { title: string; description: string; requiredSkills?: string[] },
  member: TeamMember,
  inferredSkills: InferredSkill[]
): number {
  const ticketText = `${ticket.title} ${ticket.description}`.toLowerCase();

  // Get all skills for this member
  const memberSkills = [
    ...member.skills,
    ...inferredSkills.filter((s) => s.teamMemberId === member.id).map((s) => s.skill),
  ].map((s) => s.toLowerCase());

  let score = 0;
  let maxScore = memberSkills.length || 1;

  // Check how many skills match the ticket content
  for (const skill of memberSkills) {
    if (ticketText.includes(skill)) {
      // Weight by inferred skill confidence if available
      const inferred = inferredSkills.find(
        (s) => s.teamMemberId === member.id && s.skill.toLowerCase() === skill
      );
      score += inferred ? inferred.confidence : 0.5;
    }
  }

  // Check required skills if provided
  if (ticket.requiredSkills && ticket.requiredSkills.length > 0) {
    const requiredMatch = ticket.requiredSkills.filter((rs) =>
      memberSkills.includes(rs.toLowerCase())
    ).length;
    const requiredScore = requiredMatch / ticket.requiredSkills.length;
    // Required skills are weighted heavily
    score = (score / maxScore + requiredScore * 2) / 3;
    return score;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Find best epic matches without AI (fallback)
 */
export function findBestEpicMatches(
  ticket: { title: string; description: string },
  epics: Epic[],
  epicCategories: EpicCategory[],
  limit: number = 3
): { epic: Epic; score: number }[] {
  const scored = epics.map((epic) => ({
    epic,
    score: calculateKeywordMatchScore(ticket, epic, epicCategories),
  }));

  return scored
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Find best assignee matches without AI (fallback)
 */
export function findBestAssigneeMatches(
  ticket: { title: string; description: string; requiredSkills?: string[] },
  teamMembers: TeamMember[],
  inferredSkills: InferredSkill[],
  limit: number = 3
): { member: TeamMember; score: number }[] {
  const scored = teamMembers.map((member) => ({
    member,
    score: calculateSkillMatchScore(ticket, member, inferredSkills),
  }));

  return scored
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
