/**
 * React Flow edge styling aligned with ElevenLabs workflow canvas (gold bezier links).
 */

import { MarkerType, type Edge } from 'reactflow';
import type { WorkspaceWorkflowEdge } from '../core/types';

export const EL_WORKFLOW_EDGE_STROKE = '#c4a574';
/** Plain edge caption on dark canvas (no background chip, no SVG stroke halo). */
export const EL_WORKFLOW_EDGE_LABEL_FILL = '#e2e8f0';

export function edgeDisplayLabel(edge: WorkspaceWorkflowEdge): string | undefined {
  if (edge.label?.trim()) return edge.label.trim();
  if (edge.conditionKind === 'unconditional') return 'sempre';
  if (edge.conditionText?.trim()) return edge.conditionText.trim();
  return undefined;
}

/** Builds a bezier edge with ElevenLabs-like colors and plain text label. */
export function buildElevenLabsStyleEdge(e: WorkspaceWorkflowEdge): Edge {
  return {
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    label: edgeDisplayLabel(e),
    type: 'default',
    markerEnd: { type: MarkerType.ArrowClosed, color: EL_WORKFLOW_EDGE_STROKE },
    style: { stroke: EL_WORKFLOW_EDGE_STROKE, strokeWidth: 1.5 },
    labelStyle: {
      fill: EL_WORKFLOW_EDGE_LABEL_FILL,
      fontSize: 11,
      fontWeight: 600,
    },
  };
}
