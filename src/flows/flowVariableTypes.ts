/**
 * Flow-scoped variable definitions for encapsulated flows (author view: Variables panel).
 * Consumer view (Interface) derives from visibility input/output/inout.
 */

export type FlowVariableVisibility = 'internal' | 'input' | 'output' | 'inout';

export type FlowVariableDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'semanticValue'
  | 'object'
  | 'array';

/** One variable row in the flow's Variables editor. */
export interface FlowVariableDefinition {
  id: string;
  label: string;
  type: FlowVariableDataType;
  /** Optional semantic domain label or slot id (e.g. CategoriaTicket). */
  semanticDomain?: string;
  visibility: FlowVariableVisibility;
  notes?: string;
}

export function createEmptyFlowVariable(): FlowVariableDefinition {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `fv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    label: '',
    type: 'string',
    visibility: 'internal',
  };
}
