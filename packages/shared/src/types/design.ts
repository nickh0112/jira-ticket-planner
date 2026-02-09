// ============================================================================
// Design Prototyping Feature Types
// ============================================================================

// Session status
export type DesignSessionStatus = 'designing' | 'prototype_generated' | 'approved' | 'shared';

// Message role
export type DesignMessageRole = 'user' | 'assistant';

// Source type
export type DesignSourceType = 'ticket' | 'prd' | 'freeform';

// ============================================================================
// Design Session
// ============================================================================

export interface DesignSession {
  id: string;
  title: string;
  sourceType: DesignSourceType;
  sourceId: string | null;
  status: DesignSessionStatus;
  codebaseContextId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignSessionInput {
  title: string;
  sourceType?: DesignSourceType;
  sourceId?: string;
  codebaseContextId?: string;
}

export interface UpdateDesignSessionInput {
  title?: string;
  status?: DesignSessionStatus;
  codebaseContextId?: string;
}

// ============================================================================
// Design Messages
// ============================================================================

export interface DesignMessage {
  id: string;
  sessionId: string;
  role: DesignMessageRole;
  content: string;
  createdAt: string;
}

export interface CreateDesignMessageInput {
  sessionId: string;
  role: DesignMessageRole;
  content: string;
}

// ============================================================================
// Design Prototypes
// ============================================================================

export interface DesignPrototype {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  componentCode: string;
  version: number;
  createdAt: string;
}

export interface CreateDesignPrototypeInput {
  sessionId: string;
  name: string;
  description?: string;
  componentCode: string;
  version?: number;
}

// ============================================================================
// Full Session Data (with all relations)
// ============================================================================

export interface DesignSessionFull {
  session: DesignSession;
  messages: DesignMessage[];
  prototypes: DesignPrototype[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DesignListResponse {
  sessions: DesignSession[];
  total: number;
}

export interface DesignSendMessageResponse {
  userMessage: DesignMessage;
  assistantMessage: DesignMessage;
  newPrototype?: DesignPrototype;
}

export interface GeneratePrototypeResponse {
  prototype: DesignPrototype;
  message: DesignMessage;
}

export interface ShareDesignResponse {
  method: 'code' | 'jira';
  code?: string;
  jiraCommentUrl?: string;
}
