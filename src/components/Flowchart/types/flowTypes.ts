import type { EdgeData as BaseEdgeData } from '../../hooks/useNodeManager';

// Definizione completa di NodeData senza dipendenze circolari
export interface NodeData {
  title: string;
  rows: Array<{ id: string; text: string; [key: string]: any }>;
  isTemporary?: boolean;
  hidden?: boolean;
  createdAt?: number;
  batchId?: string;
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  onPlayNode?: () => void;
  onCreateAgentAct?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateBackendCall?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateTask?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateCondition?: (name: string, scope?: 'global' | 'industry') => void;
  focusRowId?: string;
  [key: string]: any;
}

export interface EdgeData extends BaseEdgeData {
  // Eventuali estensioni specifiche per flowchart
}

export interface TemporaryNodeResult {
  tempNodeId: string;
  tempEdgeId: string;
  position: { x: number; y: number };
}
