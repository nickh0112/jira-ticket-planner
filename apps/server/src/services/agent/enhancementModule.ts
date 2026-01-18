import type {
  Ticket,
  TeamMember,
  Epic,
  InferredSkill,
  TicketEnhancements,
  qualityMetrics,
} from '@jira-planner/shared';
import { enhanceTicketDescription } from '../claudeService.js';

interface EnhancementContext {
  teamMembers: TeamMember[];
  epics: Epic[];
  inferredSkills: InferredSkill[];
  qualityThreshold: 'basic' | 'standard' | 'comprehensive';
}

/**
 * Enhance a ticket with detailed technical context, acceptance criteria, and AI coding notes
 */
export async function enhanceTicket(
  ticket: Ticket,
  context: EnhancementContext
): Promise<TicketEnhancements> {
  // Call Claude to enhance the ticket
  const enhancements = await enhanceTicketDescription(ticket, context);

  return enhancements;
}

/**
 * Validate that a ticket meets the quality threshold
 */
export function validateQuality(
  enhancements: TicketEnhancements,
  threshold: 'basic' | 'standard' | 'comprehensive'
): { meetsThreshold: boolean; score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Check description length
  const descLength = enhancements.enhancedDescription.length;
  const minDescLength = getMinDescriptionLength(threshold);
  if (descLength >= minDescLength) {
    score += 25;
  } else {
    issues.push(`Description too short (${descLength}/${minDescLength} chars)`);
    score += Math.floor((descLength / minDescLength) * 25);
  }

  // Check acceptance criteria count
  const acCount = enhancements.addedAcceptanceCriteria.length;
  const minAcCount = getMinAcceptanceCriteria(threshold);
  if (acCount >= minAcCount) {
    score += 25;
  } else {
    issues.push(`Need more acceptance criteria (${acCount}/${minAcCount})`);
    score += Math.floor((acCount / minAcCount) * 25);
  }

  // Check for success metrics (standard and comprehensive)
  if (threshold === 'standard' || threshold === 'comprehensive') {
    if (enhancements.successMetrics.length > 0) {
      score += 15;
    } else if (threshold === 'comprehensive') {
      issues.push('Missing success metrics');
    }
  } else {
    score += 15; // Not required for basic
  }

  // Check for technical context (comprehensive only)
  if (threshold === 'comprehensive') {
    if (enhancements.technicalContext.length >= 50) {
      score += 20;
    } else {
      issues.push('Need more detailed technical context');
      score += Math.floor((enhancements.technicalContext.length / 50) * 20);
    }

    // Check for AI coding notes
    if (enhancements.aiCodingNotes && enhancements.aiCodingNotes.length >= 30) {
      score += 15;
    } else {
      issues.push('Missing or incomplete AI coding notes');
    }
  } else {
    score += 35; // Not required for basic/standard
  }

  // Determine if threshold is met
  const thresholdScore = getThresholdScore(threshold);
  const meetsThreshold = score >= thresholdScore && issues.length === 0;

  return {
    meetsThreshold,
    score: Math.min(score, maxScore),
    issues,
  };
}

function getMinDescriptionLength(threshold: 'basic' | 'standard' | 'comprehensive'): number {
  switch (threshold) {
    case 'basic':
      return 50;
    case 'standard':
      return 150;
    case 'comprehensive':
      return 300;
  }
}

function getMinAcceptanceCriteria(threshold: 'basic' | 'standard' | 'comprehensive'): number {
  switch (threshold) {
    case 'basic':
      return 1;
    case 'standard':
      return 3;
    case 'comprehensive':
      return 5;
  }
}

function getThresholdScore(threshold: 'basic' | 'standard' | 'comprehensive'): number {
  switch (threshold) {
    case 'basic':
      return 50;
    case 'standard':
      return 70;
    case 'comprehensive':
      return 85;
  }
}

/**
 * Generate a quality report for a ticket
 */
export function generateQualityReport(
  ticket: Ticket,
  enhancements: TicketEnhancements | null,
  threshold: 'basic' | 'standard' | 'comprehensive'
): {
  originalQuality: { score: number; issues: string[] };
  enhancedQuality: { score: number; issues: string[] } | null;
  improvement: number;
} {
  // Score original ticket
  const originalEnhancements: TicketEnhancements = {
    originalDescription: ticket.description,
    enhancedDescription: ticket.description,
    addedAcceptanceCriteria: ticket.acceptanceCriteria,
    successMetrics: [],
    technicalContext: '',
    aiCodingNotes: undefined,
  };
  const originalResult = validateQuality(originalEnhancements, threshold);

  if (!enhancements) {
    return {
      originalQuality: { score: originalResult.score, issues: originalResult.issues },
      enhancedQuality: null,
      improvement: 0,
    };
  }

  // Score enhanced ticket
  const enhancedResult = validateQuality(enhancements, threshold);

  return {
    originalQuality: { score: originalResult.score, issues: originalResult.issues },
    enhancedQuality: { score: enhancedResult.score, issues: enhancedResult.issues },
    improvement: enhancedResult.score - originalResult.score,
  };
}
