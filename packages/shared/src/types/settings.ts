// ============================================================================
// Settings Types
// ============================================================================

// Project context for AI brainstorming
export interface ProjectContext {
  id: string;
  projectName: string;
  description: string;
  techStack: string;
  architecture: string;
  productAreas: string;
  conventions: string;
  additionalContext: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContextInput {
  projectName: string;
  description: string;
  techStack: string;
  architecture: string;
  productAreas: string;
  conventions: string;
  additionalContext: string;
}
