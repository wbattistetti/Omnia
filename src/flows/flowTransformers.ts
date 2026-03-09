import type { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';

/**
 * Simplified node structure (without ReactFlow data wrapper)
 * This is what we store in the database and send to the backend
 */
export interface SimplifiedNode {
  id: string;
  label?: string;
  rows: any[];
  position?: { x: number; y: number };
  type?: string;
  // Other properties that might be needed
  [key: string]: any;
}

/**
 * Simplified edge structure
 */
export interface SimplifiedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
  style?: any;
  markerEnd?: string;
  // Other properties that might be needed
  [key: string]: any;
}

/**
 * Transform ReactFlow Node to simplified structure (for saving/backend)
 * Extracts data.rows and data.label to top level
 */
export function transformNodeToSimplified(node: Node<FlowNode>): SimplifiedNode {
  const simplified: SimplifiedNode = {
    id: node.id,
    label: node.data?.label || '',
    rows: node.data?.rows || [],
    position: node.position,
    type: node.type,
  };

  // Copy other properties from node (excluding data wrapper)
  Object.keys(node).forEach(key => {
    if (key !== 'data' && key !== 'id' && key !== 'position' && key !== 'type') {
      (simplified as any)[key] = (node as any)[key];
    }
  });

  // Copy other properties from node.data (excluding label and rows)
  if (node.data) {
    Object.keys(node.data).forEach(key => {
      if (key !== 'label' && key !== 'rows') {
        (simplified as any)[key] = (node.data as any)[key];
      }
    });
  }

  // ✅ LOG: Traccia cosa viene salvato per ogni row
  if (simplified.rows && simplified.rows.length > 0) {
    // Log rimosso: non essenziale per flusso motore
  }

  return simplified;
}

/**
 * Transform simplified structure to ReactFlow Node (for loading)
 * Wraps rows and label into data property
 */
export function transformNodeToReactFlow(simplified: SimplifiedNode): Node<FlowNode> {
  const reactFlowNode: Node<FlowNode> = {
    id: simplified.id,
    type: simplified.type || 'custom',
    position: simplified.position || { x: 0, y: 0 },
    data: {
      label: simplified.label || '',
      rows: simplified.rows || [],
    },
  };

  // Copy other properties from simplified (excluding id, type, position, label, rows)
  Object.keys(simplified).forEach(key => {
    if (key !== 'id' && key !== 'type' && key !== 'position' && key !== 'label' && key !== 'rows') {
      // Put in data if it's a UI-related property, otherwise on node level
      if (['isTemporary', 'hidden', 'createdAt', 'batchId', 'focusRowId', 'hideUncheckedRows'].includes(key)) {
        (reactFlowNode.data as any)[key] = (simplified as any)[key];
      } else {
        (reactFlowNode as any)[key] = (simplified as any)[key];
      }
    }
  });

  // ✅ LOG: Traccia cosa viene caricato per ogni row
  if (reactFlowNode.data.rows && reactFlowNode.data.rows.length > 0) {
    // Log rimosso: non essenziale per flusso motore
  }

  return reactFlowNode;
}

/**
 * Transform ReactFlow Edge to simplified structure
 */
export function transformEdgeToSimplified(edge: any): SimplifiedEdge {
  const simplified: SimplifiedEdge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    type: edge.type,
    style: edge.style,
    markerEnd: edge.markerEnd,
  };

  // ✅ Copy persistent fields from top-level (NOT from data)
  const persistentFields = [
    'conditionId',
    'isElse',
    'linkStyle',
    'controlPoints',
    'labelPositionRelative',
    'labelPositionSvg'
  ];

  persistentFields.forEach(field => {
    if (edge[field] !== undefined) {
      (simplified as any)[field] = edge[field];
    }
  });

  // ✅ Log if conditionId is present
  if (edge.conditionId) {
    console.log('[transformEdgeToSimplified] ✅ Preserving conditionId', {
      edgeId: edge.id,
      conditionId: edge.conditionId,
      simplifiedHasConditionId: !!(simplified as any).conditionId
    });
  }

  // ✅ Copy other top-level properties (excluding React Flow internals)
  Object.keys(edge).forEach(key => {
    if (!['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'label', 'type', 'style', 'markerEnd', 'data', 'selected', 'animated', 'hidden'].includes(key)) {
      if (!persistentFields.includes(key)) {
        (simplified as any)[key] = edge[key];
      }
    }
  });

  return simplified;
}

/**
 * Transform simplified edge to ReactFlow Edge
 */
export function transformEdgeToReactFlow(simplified: SimplifiedEdge): any {
  const reactFlowEdge: any = {
    id: simplified.id,
    source: simplified.source,
    target: simplified.target,
    sourceHandle: simplified.sourceHandle,
    targetHandle: simplified.targetHandle,
    label: simplified.label,
    type: simplified.type || 'custom',
    style: simplified.style,
    markerEnd: simplified.markerEnd,
  };

  // ✅ Copy persistent fields to top-level (NOT to data)
  const persistentFields = [
    'conditionId',
    'isElse',
    'linkStyle',
    'controlPoints',
    'labelPositionRelative',
    'labelPositionSvg'
  ];

  persistentFields.forEach(field => {
    if ((simplified as any)[field] !== undefined) {
      reactFlowEdge[field] = (simplified as any)[field];
    }
  });

  // ✅ Log if conditionId is present
  if (reactFlowEdge.conditionId) {
    console.log('[transformEdgeToReactFlow] ✅ Restoring conditionId', {
      edgeId: reactFlowEdge.id,
      conditionId: reactFlowEdge.conditionId
    });
  }

  // ✅ Copy other top-level properties
  Object.keys(simplified).forEach(key => {
    if (!['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'label', 'type', 'style', 'markerEnd'].includes(key)) {
      if (!persistentFields.includes(key)) {
        reactFlowEdge[key] = (simplified as any)[key];
      }
    }
  });

  // ✅ data is ONLY for non-persistent callbacks (if any)
  // Do NOT copy persistent fields to data

  return reactFlowEdge;
}

/**
 * Transform array of ReactFlow nodes to simplified
 */
export function transformNodesToSimplified(nodes: Node<FlowNode>[]): SimplifiedNode[] {
  return nodes.map(transformNodeToSimplified);
}

/**
 * Transform array of simplified nodes to ReactFlow
 */
export function transformNodesToReactFlow(simplified: SimplifiedNode[]): Node<FlowNode>[] {
  return simplified.map(transformNodeToReactFlow);
}

/**
 * Transform array of ReactFlow edges to simplified
 */
export function transformEdgesToSimplified(edges: any[]): SimplifiedEdge[] {
  return edges.map(transformEdgeToSimplified);
}

/**
 * Transform array of simplified edges to ReactFlow
 */
export function transformEdgesToReactFlow(simplified: SimplifiedEdge[]): any[] {
  return simplified.map(transformEdgeToReactFlow);
}






