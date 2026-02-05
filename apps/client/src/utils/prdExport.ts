import type { IdeaPRD } from '@jira-planner/shared';

/**
 * Generate formatted markdown from a PRD
 */
export function generatePRDMarkdown(prd: IdeaPRD): string {
  // If rawContent exists and is populated, use it
  if (prd.rawContent && prd.rawContent.trim().length > 100) {
    return prd.rawContent;
  }

  // Otherwise, generate from structured data
  return `# ${prd.title}

## Problem Statement
${prd.problemStatement}

## Goals
${prd.goals.map(g => `- ${g}`).join('\n')}

## User Stories
${prd.userStories.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Functional Requirements
${prd.functionalRequirements.map(r => `- [ ] ${r}`).join('\n')}

## Non-Functional Requirements
${prd.nonFunctionalRequirements}

## Success Metrics
${prd.successMetrics}

## Scope

### In Scope
${prd.scopeBoundaries.inScope.map(s => `- ${s}`).join('\n')}

### Out of Scope
${prd.scopeBoundaries.outOfScope.map(s => `- ${s}`).join('\n')}

${prd.technicalConsiderations ? `## Technical Considerations
${prd.technicalConsiderations}` : ''}

---
*Generated from Idea Forge*
*Created: ${new Date(prd.createdAt).toLocaleDateString()}*
*Last updated: ${new Date(prd.updatedAt).toLocaleDateString()}*
`;
}

/**
 * Copy PRD markdown to clipboard
 */
export async function copyPRDToClipboard(prd: IdeaPRD): Promise<void> {
  const markdown = generatePRDMarkdown(prd);
  await navigator.clipboard.writeText(markdown);
}

/**
 * Download PRD as a markdown file
 */
export function downloadPRD(prd: IdeaPRD): void {
  const markdown = generatePRDMarkdown(prd);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(prd.title)}-prd.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate Confluence-compatible format
 * Confluence uses similar markdown but with some differences
 */
export function generateConfluenceFormat(prd: IdeaPRD): string {
  // Confluence uses slightly different syntax for some elements
  // This is essentially the same as markdown for most use cases
  // but we can add Confluence-specific macros if needed
  return `h1. ${prd.title}

h2. Problem Statement
${prd.problemStatement}

h2. Goals
${prd.goals.map(g => `* ${g}`).join('\n')}

h2. User Stories
||#||Story||
${prd.userStories.map((s, i) => `|${i + 1}|${s}|`).join('\n')}

h2. Functional Requirements
${prd.functionalRequirements.map(r => `* {status:colour=Grey|title=TODO} ${r}`).join('\n')}

h2. Non-Functional Requirements
${prd.nonFunctionalRequirements}

h2. Success Metrics
${prd.successMetrics}

h2. Scope

h3. In Scope
${prd.scopeBoundaries.inScope.map(s => `(/) ${s}`).join('\n')}

h3. Out of Scope
${prd.scopeBoundaries.outOfScope.map(s => `(x) ${s}`).join('\n')}

${prd.technicalConsiderations ? `h2. Technical Considerations
${prd.technicalConsiderations}` : ''}

----
{info}Generated from Idea Forge{info}
`;
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}
