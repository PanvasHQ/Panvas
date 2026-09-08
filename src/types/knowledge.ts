export type KnowledgeStatus = 'draft' | 'active' | 'evergreen' | 'archived' | 'disputed' | string;

export interface KnowledgeNoteRef {
  path: string;
  id?: string;
  title: string;
  type?: string;
  status?: KnowledgeStatus;
}

export interface KnowledgeProvenance {
  status?: string;
  confidence?: string;
  captured?: string;
  reviewed?: string;
  sources: KnowledgeNoteRef[];
}

export interface KnowledgeRelationship {
  from: KnowledgeNoteRef;
  to: KnowledgeNoteRef;
  relation: string;
  direction: 'outgoing' | 'incoming';
  typed: boolean;
}

export interface KnowledgeNoteSummary {
  ref: KnowledgeNoteRef;
  excerpt: string;
  tags: string[];
  provenance: KnowledgeProvenance;
  uncertainty: string[];
}

export interface KnowledgeNoteContext extends KnowledgeNoteSummary {
  content: string;
  relationships: KnowledgeRelationship[];
}

export interface KnowledgeSearchInput {
  query: string;
  types?: string[];
  statuses?: KnowledgeStatus[];
  tags?: string[];
  limit?: number;
}

export interface KnowledgeSearchResult {
  query: string;
  results: KnowledgeNoteSummary[];
  reason: 'deterministic-local-text-and-metadata-match';
}

export interface KnowledgeReferenceInput {
  path?: string;
  id?: string;
}

export interface FindRelatedInput extends KnowledgeReferenceInput {
  depth?: 1 | 2;
  limit?: number;
}

export interface KnowledgeHealthReport {
  checkedAt: string;
  markdownFiles: number;
  managedRecords: number;
  schemaViolations: string[];
  invalidIds: string[];
  duplicateIds: string[];
  brokenLinks: string[];
  orphanRecords: string[];
  invalidRelations: string[];
  missingProvenance: string[];
  staleSources: string[];
  disputedRecords: string[];
  plannedRecords: string[];
}

export type KnowledgeResponse<T> =
  | { available: true; data: T }
  | {
      available: false;
      reason: 'not-configured' | 'not-found' | 'invalid-request' | 'unavailable';
      message: string;
    };

export interface PanvasKnowledgeAPI {
  search_knowledge: (input: KnowledgeSearchInput) => Promise<KnowledgeResponse<KnowledgeSearchResult>>;
  get_note_context: (input: KnowledgeReferenceInput) => Promise<KnowledgeResponse<KnowledgeNoteContext>>;
  find_related: (input: FindRelatedInput) => Promise<KnowledgeResponse<KnowledgeRelationship[]>>;
  knowledge_health: () => Promise<KnowledgeResponse<KnowledgeHealthReport>>;
  get_note_ref: (input: KnowledgeReferenceInput) => Promise<KnowledgeResponse<KnowledgeNoteRef>>;
}
