import type { EdgeData as BaseEdgeData } from '../../hooks/useEdgeManager';

/**
 * Link style enumeration for edge rendering patterns
 * Defines how edges/links are visually rendered in the flowchart
 */
export enum LinkStyle {
  /** Auto-selects VHV or HVH based on geometry (dy > dx → VHV, otherwise HVH) */
  AutoOrtho = 'auto-ortho',
  /** Smooth step with rounded corners */
  SmoothStep = 'smoothstep',
  /** Bezier curve */
  Bezier = 'bezier',
  /** Orthogonal step (auto HV or VH based on distance) */
  Step = 'step',
  /** Horizontal-Vertical-Horizontal pattern */
  HVH = 'HVH',
  /** Vertical-Horizontal-Vertical pattern */
  VHV = 'VHV',
}

/**
 * Default link style for new edges
 */
export const DEFAULT_LINK_STYLE = LinkStyle.VHV;

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
  /**
   * Link style pattern
   */
  linkStyle?: LinkStyle;
  /**
   * Control points for custom path editing (Phase 2)
   * Array of {x, y} coordinates in SVG space
   */
  controlPoints?: Array<{ x: number; y: number }>;
  /**
   * Custom label position (SVG coordinates)
   * If not set, label is positioned at edge midpoint
   */
  labelPositionSvg?: { x: number; y: number };
  // Eventuali estensioni specifiche per flowchart
}

export interface TemporaryNodeResult {
  tempNodeId: string;
  tempEdgeId: string;
  position: { x: number; y: number };
}
