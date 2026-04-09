/**
 * Flow-centric atomic document: single source of truth for one flow canvas.
 * No global task/variable/translation collections — all data for this flow lives here.
 */

import type { Task } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';

/** Persisted interface row: stable id, variable wire, translation key for meta.translations. */
export interface FlowInterfaceRowPersisted {
  id: string;
  variableRefId: string;
  /** Key into FlowDocument.meta.translations */
  labelKey: string;
  direction: 'input' | 'output';
}

export type FlowSubflowBindingPersisted = {
  interfaceParameterId: string;
  parentVariableId: string;
};

export type FlowDocumentMeta = {
  flowInterface: {
    input: FlowInterfaceRowPersisted[];
    output: FlowInterfaceRowPersisted[];
  };
  settings?: Record<string, unknown>;
  /** Flow-local translation table (labelKey → display string). */
  translations: Record<string, string>;
};

/**
 * Simplified graph node (matches flow API / FlowPersistence simplified shape before ReactFlow wrap).
 */
export type FlowDocumentSimplifiedNode = Record<string, unknown>;

export type FlowDocumentSimplifiedEdge = Record<string, unknown>;

export type FlowDocument = {
  id: string;
  projectId: string;
  meta: FlowDocumentMeta;
  nodes: FlowDocumentSimplifiedNode[];
  edges: FlowDocumentSimplifiedEdge[];
  /** Tasks that belong only to this flow canvas. */
  tasks: Task[];
  /** Variable rows scoped to this flow. */
  variables: VariableInstance[];
  /** Subflow interface bindings for Subflow tasks on this canvas. */
  bindings: FlowSubflowBindingPersisted[];
  version: number;
};

export const FLOW_DOCUMENT_VERSION = 1;
