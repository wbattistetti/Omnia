import type { EdgeData as BaseEdgeData } from '../../hooks/useEdgeManager';

/**
 * Simplified FlowNode model - directly contains rows without intermediate wrapper
 * This replaces the old NodeData wrapper for a cleaner, more direct structure
 */
export interface FlowNode {
  label?: string;  // Node title (ex title)
  rows: NodeRow[];  // Rows directly, without wrapper
  position?: { x: number; y: number };  // ReactFlow position
  type?: string;  // ReactFlow type
  // UI state fields
  isTemporary?: boolean;
  hidden?: boolean;
  createdAt?: number;
  batchId?: string;
  // Callback functions
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  onPlayNode?: () => void;
  onCreateFactoryTask?: (name: string, scope?: 'global' | 'industry') => void; // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
  onCreateBackendCall?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateTask?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateCondition?: (name: string, scope?: 'global' | 'industry') => void;
  focusRowId?: string;
  [key: string]: any;
}

/**
 * NodeRow represents a single row in a FlowNode
 * Each row corresponds to a TaskInstance via row.id === task.id (GUID)
 */
export interface NodeRow {
  id: string;        // UUID della riga (topological ID)
  text: string;      // Testo visualizzato
  taskId?: string;   // Reference to Task (1:1)
  included?: boolean; // true se la row è inclusa nel flusso
  [key: string]: any;
}

// NodeData removed - use FlowNode directly

export interface EdgeData extends BaseEdgeData {
  // Eventuali estensioni specifiche per flowchart
}

export interface TemporaryNodeResult {
  tempNodeId: string;
  tempEdgeId: string;
  position: { x: number; y: number };
}
