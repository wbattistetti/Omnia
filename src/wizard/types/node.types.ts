// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Types
 *
 * Defines types specific to node management and state.
 */

import type { NodeMode, NodeState } from './wizard.types';

export interface NodeStateInfo {
  nodeId: string;
  mode: NodeMode;
  state: NodeState;
  progress?: number; // 0-100
  error?: string;
  lastUpdated: Date;
}

export interface NodeModeConfig {
  nodeId: string;
  mode: NodeMode;
  propagated?: boolean; // True if mode was propagated from parent
}

export interface NodeTree {
  root: SchemaNode;
  nodes: Map<string, SchemaNode>;
  modeMap: Map<string, NodeMode>;
  stateMap: Map<string, NodeState>;
}

export interface SchemaNode {
  id: string;
  label: string;
  type?: string;
  icon?: string;
  subData?: SchemaNode[];
  subTasks?: SchemaNode[];
  constraints?: Constraint[];
  mode?: NodeMode;
  state?: NodeState;
  parentId?: string;
  depth?: number;
}

export interface Constraint {
  kind: 'required' | 'range' | 'length' | 'regex' | 'enum' | 'format' | 'pastDate' | 'futureDate';
  title: string;
  payoff: string;
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  values?: Array<string | number>;
  format?: string;
}
