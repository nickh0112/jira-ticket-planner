// ============================================================================
// Codebase Analysis Types
// ============================================================================

export interface CodebaseAnalysis {
  id: string;
  name: string;
  rootPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalDirectories: number;
  languageBreakdown: Record<string, number>;
  fileTree: { path: string; type: 'file' | 'directory'; language?: string }[];
  exports: { filePath: string; name: string; kind: string; signature?: string }[];
  routes: { method: string; path: string; filePath: string }[];
  dependencies: { name: string; version: string; isDev: boolean }[];
  schemaHints: { source: string; tables: string[]; rawSnippet?: string }[];
  contextSummary: string;
}

export interface CodebaseContext {
  id: string;
  name: string;
  rootPath: string;
  analyzedAt: string;
  totalFiles: number;
  contextSummary: string;
  rawAnalysis: string;
  createdAt: string;
}

export interface CodebaseContextListItem {
  id: string;
  name: string;
  rootPath: string;
  analyzedAt: string;
  totalFiles: number;
  languageBreakdown: Record<string, number>;
  createdAt: string;
}
