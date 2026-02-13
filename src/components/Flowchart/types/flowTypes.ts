import type { EdgeData as BaseEdgeData } from '../../hooks/useEdgeManager';
import { TaskType } from '../../../types/taskTypes';

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
 * Each row corresponds to a Task via row.id === task.id (ALWAYS)
 *
 * Architettura pulita:
 * - row.id ALWAYS equals task.id (quando task esiste)
 * - row.heuristics contiene solo dati euristici per lazy task creation
 * - Tutti gli altri dati (type, category, templateId) vengono dal task o da heuristics
 */
export interface NodeRow {
  // ✅ Dati strutturali UI
  id: string;                    // UUID della riga - ALWAYS equals task.id when task exists
  text: string;                  // Testo visualizzato
  included?: boolean;            // Flag inclusione nel flusso

  // ✅ Dati euristici (SOLO quando task non esiste ancora - lazy creation)
  heuristics?: {
    type?: TaskType;              // Tipo dedotto dall'euristica
    templateId?: string | null;   // Template ID dedotto dall'euristica
    inferredCategory?: string | null; // Categoria semantica dedotta (es. 'problem-classification', 'choice', 'confirmation')
  };

  // ✅ Metadati UI/organizzativi
  factoryId?: string;             // ID template factory (quando la riga referenzia un template)
  isUndefined?: boolean;          // Flag tipo undefined (per UI - mostra icona "?")

  // ❌ RIMOSSO: [key: string]: any - non più necessario, struttura esplicita
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
