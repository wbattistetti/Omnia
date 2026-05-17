/**
 * Accepts ElevenLabs workflow node drag-drop on the Omnia flow canvas.
 */

import { useCallback, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { Node } from 'reactflow';
import {
  hasElevenLabsNodeDrag,
  readElevenLabsNodeDragPayload,
} from '@workspaces/elevenlabs/elevenLabsDragPayload';
import {
  dropElevenLabsNodeOnFlow,
  findCanvasNodeIdByElevenLabsNodeId,
} from '@workspaces/elevenlabs/dropElevenLabsNodeOnFlow';
import type { FlowNode } from '../types/flowTypes';
import { TaskType } from '@types/taskTypes';

export type ElevenLabsFlowDropMessage = {
  kind: 'created' | 'exists';
  label: string;
  detail: string;
};

export function useElevenLabsFlowDrop(params: {
  nodes: Node<FlowNode>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>;
  projectId: string | undefined;
  flowId?: string;
  onDropMessage?: (msg: ElevenLabsFlowDropMessage) => void;
}): {
  elDropActive: boolean;
  onFlowDragOver: (e: React.DragEvent) => void;
  onFlowDragLeave: (e: React.DragEvent) => void;
  onFlowDrop: (e: React.DragEvent) => void;
} {
  const { nodes, setNodes, projectId, flowId, onDropMessage } = params;
  const reactFlowInstance = useReactFlow();
  const [elDropActive, setElDropActive] = useState(false);

  const onFlowDragOver = useCallback((e: React.DragEvent) => {
    if (!hasElevenLabsNodeDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setElDropActive(true);
  }, []);

  const onFlowDragLeave = useCallback((e: React.DragEvent) => {
    const rel = e.relatedTarget;
    if (rel instanceof globalThis.Node && e.currentTarget.contains(rel)) return;
    setElDropActive(false);
  }, []);

  const onFlowDrop = useCallback(
    (e: React.DragEvent) => {
      setElDropActive(false);
      const payload = readElevenLabsNodeDragPayload(e.dataTransfer);
      if (!payload) return;
      e.preventDefault();
      e.stopPropagation();

      const existing = findCanvasNodeIdByElevenLabsNodeId(nodes, payload.node.id);
      if (existing) {
        onDropMessage?.({
          kind: 'exists',
          label: payload.node.label,
          detail: 'Esiste già un nodo canvas per questo step ElevenLabs.',
        });
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const result = dropElevenLabsNodeOnFlow({
        payload,
        position,
        projectId,
        existingCanvasNodes: nodes,
      });

      setNodes((prev) => [...prev, result.newNode]);

      const fid = String(flowId ?? '').trim();
      window.setTimeout(() => {
        document.dispatchEvent(
          new CustomEvent('taskEditor:open', {
            bubbles: true,
            detail: {
              id: result.taskId,
              type: TaskType.AIAgent,
              label: result.label,
              ...(fid ? { flowId: fid } : {}),
            },
          })
        );
      }, 0);

      const parts: string[] = [`Creato Agente AI «${result.label}» sul canvas`];
      if (result.importSummary.promptApplied) parts.push('prompt importato');
      if (result.importSummary.backendsAdded > 0) {
        parts.push(`${result.importSummary.backendsAdded} backend`);
      }
      onDropMessage?.({
        kind: 'created',
        label: result.label,
        detail: parts.join(' · '),
      });
    },
    [nodes, setNodes, projectId, flowId, reactFlowInstance, onDropMessage]
  );

  return { elDropActive, onFlowDragOver, onFlowDragLeave, onFlowDrop };
}
