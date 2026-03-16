// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ReactNode } from 'react';
import type { SemanticSlot, SemanticSet, SemanticValue } from './grammarTypes';

/**
 * TreeNode: Generic tree node for hierarchical display
 */
export interface TreeNode {
  id: string;
  type: 'slot' | 'semantic-set' | 'semantic-value' | 'linguistic-value' | 'add';
  label: string;
  icon?: ReactNode;
  data: SemanticSlot | SemanticSet | SemanticValue | string | null;
  children?: TreeNode[];
  level: number;
  parentId?: string | null;
}

/**
 * TreeState: State for tree expansion and selection
 */
export interface TreeState {
  expanded: Set<string>;
  selected: string | null;
}

/**
 * AddNodeState: State for "..." add node editing
 */
export interface AddNodeState {
  isEditing: boolean;
  editValue: string;
  parentId: string | null;
  parentType: TreeNode['type'] | null;
}

/**
 * Operation: Represents an undoable/redoable operation
 */
export interface Operation {
  id: string;
  type: 'add' | 'update' | 'delete' | 'reorder';
  entityType: 'slot' | 'semantic-set' | 'semantic-value' | 'linguistic-value';
  entityId: string;
  previousState: unknown;
  newState: unknown;
  timestamp: number;
}

/**
 * UndoRedoState: State for undo/redo stack
 */
export interface UndoRedoState {
  undoStack: Operation[];
  redoStack: Operation[];
  maxStackSize: number;
}

/**
 * ValidationResult: Result of validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

/**
 * SynonymSuggestion: Suggestion for synonyms
 */
export interface SynonymSuggestion {
  value: string;
  confidence: number;
  source: 'similarity' | 'semantic' | 'pattern';
}
