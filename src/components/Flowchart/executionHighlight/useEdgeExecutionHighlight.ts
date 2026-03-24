// Hook for calculating edge/link execution highlight
import { useMemo, useEffect, useRef } from 'react';
import { useExecutionState } from './ExecutionStateContext';
import { Highlight } from './executionHighlightConstants';
import type { Edge } from 'reactflow';
import type { EdgeData } from '../types/flowTypes';
import { evaluateCondition } from '../../DialogueEngine/conditionEvaluator';
import { FlowWorkspaceSnapshot } from '../../../flows/FlowWorkspaceSnapshot';

/**
 * Hook to get execution highlight styles for an edge/link
 * @param edge - The edge to highlight
 * @param allEdges - All edges in the flowchart (for detecting multiple valid links)
 */
export function useEdgeExecutionHighlight(
  edge: Edge<EdgeData>,
  allEdges?: Edge<EdgeData>[]
): {
  stroke: string;
  strokeWidth: number;
  isError: boolean; // true if multiple valid links (logical error)
} {
  const execState = useExecutionState();
  const errorReportedRef = useRef<Set<string>>(new Set());

  const edges = allEdges || FlowWorkspaceSnapshot.getEdges();

  const highlightResult = useMemo(() => {
    if (!execState || !execState.isRunning || !execState.executionState) {
      return {
        stroke: edge.style?.stroke || '#8b5cf6',
        strokeWidth: 1.5,
        isError: false
      };
    }

    // Check if source node is executed
    // A node is "executed" if:
    // 1. We've moved past it (currentNodeId is different from sourceNodeId), OR
    // 2. Any task from that node is executed (task IDs often contain node ID)
    const sourceNodeId = edge.source;
    const currentNodeId = execState.executionState.currentNodeId;
    const executedTaskIds = Array.from(execState.executionState.executedTaskIds);

    // Heuristic 1: If we've moved past the source node, it's likely executed
    const hasMovedPast = currentNodeId !== null && currentNodeId !== sourceNodeId;

    // Heuristic 2: Check if any executed task belongs to this node
    // Task IDs often include node ID as part of their structure
    const hasExecutedTask = executedTaskIds.some(taskId => {
      // Task IDs often include node ID as prefix or contain it
      return taskId.includes(sourceNodeId) || taskId.startsWith(sourceNodeId);
    });

    const sourceNodeExecuted = hasMovedPast || hasExecutedTask;

    // 🎨 [HIGHLIGHT] Log edge highlighting calculation (removed - too noisy)

    // If source node is not executed, no highlight
    if (!sourceNodeExecuted) {
      return {
        stroke: edge.style?.stroke || '#8b5cf6',
        strokeWidth: 1.5,
        isError: false
      };
    }

    // ✅ Check if edge has a conditionId (top-level)
    const conditionId = (edge as any).conditionId;
    const hasCondition = !!conditionId;

    if (!hasCondition) {
      return {
        stroke: edge.style?.stroke || '#8b5cf6',
        strokeWidth: 1.5,
        isError: false
      };
    }

    // Evaluate condition using conditionId
    try {
      const conditionResult = evaluateCondition(
        { type: 'EdgeCondition', edgeId: edge.id, condition: conditionId },
        execState.executionState
      );

      if (conditionResult) {
        // Condition is true - check if multiple links from same source are valid
        const sourceNodeId = edge.source;
        const edgesFromSource = edges.filter(e => e.source === sourceNodeId);

        // Evaluate all conditions for edges from the same source
        const validEdges = edgesFromSource.filter(e => {
          if (e.id === edge.id) return true; // Include current edge
          const otherConditionId = (e as any).conditionId;  // ✅ Top-level
          if (!otherConditionId) return false;

          try {
            return evaluateCondition(
              { type: 'EdgeCondition', edgeId: e.id, condition: otherConditionId },
              execState.executionState!
            );
          } catch {
            return false;
          }
        });

        // If more than one valid link, it's an error (logical error)
        const isError = validEdges.length > 1;

        // 🎨 [HIGHLIGHT] Log edge condition evaluation (only if error)
        if (isError) {
          console.warn('🎨 [HIGHLIGHT] Multiple valid edges detected (logical error)', {
            edgeId: edge.id,
            sourceNodeId,
            validEdgesCount: validEdges.length
          });
        }

        return {
          stroke: isError ? Highlight.Edge.multipleValidError : Highlight.Edge.validCondition,
          strokeWidth: Highlight.Edge.validConditionStrokeWidth, // ✅ Usa spessore dalla costante (2px)
          isError,
          sourceNodeId, // Include sourceNodeId for error reporting
          validEdgesCount: validEdges.length
        };
      }
    } catch (error) {
      console.warn('🎨 [HIGHLIGHT] Edge condition evaluation error', { edgeId: edge.id, error });
    }

    return {
      stroke: edge.style?.stroke || '#8b5cf6',
      strokeWidth: 1.5,
      isError: false,
      sourceNodeId: edge.source,
      validEdgesCount: 0
    };
  }, [execState, edge, edges]);

  // ✅ Send error message to chat when multiple valid links are detected
  useEffect(() => {
    if (highlightResult.isError && highlightResult.sourceNodeId) {
      const errorKey = `flow-ambiguity-${highlightResult.sourceNodeId}`;

      // Check if we've already reported this error for this node
      if (!errorReportedRef.current.has(errorKey)) {
        errorReportedRef.current.add(errorKey);

        // Get onMessage from FlowStateBridge
        const onMessage = FlowStateBridge.getFlowOnMessage();

        if (onMessage) {
          // Send system message with error icon
          onMessage({
            id: `flow-ambiguity-${highlightResult.sourceNodeId}-${Date.now()}`,
            type: 'system',
            text: 'Flow ambiguity',
            stepType: 'error',
            timestamp: new Date()
          });
          console.log('🎨 [HIGHLIGHT] Flow ambiguity error message sent to chat', {
            sourceNodeId: highlightResult.sourceNodeId,
            validEdgesCount: highlightResult.validEdgesCount
          });
        }
      }
    } else if (!highlightResult.isError && highlightResult.sourceNodeId) {
      // Clear error key when error is resolved
      const errorKey = `flow-ambiguity-${highlightResult.sourceNodeId}`;
      errorReportedRef.current.delete(errorKey);
    }
  }, [highlightResult.isError, highlightResult.sourceNodeId, highlightResult.validEdgesCount]);

  return {
    stroke: highlightResult.stroke,
    strokeWidth: highlightResult.strokeWidth,
    isError: highlightResult.isError
  };
}

