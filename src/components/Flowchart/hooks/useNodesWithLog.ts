import { useRef, useCallback } from 'react';
import type { Node } from 'reactflow';
import type { NodeData } from '../types/flowTypes';

export function useNodesWithLog(setNodes: (updater: any) => void) {
  const isCreatingTempNode = useRef(false);

  const setNodesWithLog = useCallback((updater: any) => {
    if (isCreatingTempNode.current) {
      console.log("🚫 [SET_NODES] BLOCKED - Node creation already in progress");
      return;
    }
    isCreatingTempNode.current = true;

    if (typeof updater === 'function') {
      setNodes((currentNodes: Node<NodeData>[]) => {
        const newNodes = updater(currentNodes);
        // Logging posizione temporanei
        currentNodes.forEach((oldNode, index) => {
          const newNode = newNodes[index];
          if (newNode && (newNode.data as any)?.isTemporary) {
            const positionChanged = oldNode.position.x !== newNode.position.x || oldNode.position.y !== newNode.position.y;
            if (positionChanged) {
              console.log("⚠️ [POSITION] Temporary node position changed", {
                nodeId: newNode.id,
                oldPosition: oldNode.position,
                newPosition: newNode.position,
                deltaX: newNode.position.x - oldNode.position.x,
                deltaY: newNode.position.y - oldNode.position.y,
                timestamp: Date.now()
              });
            }
          }
        });
        queueMicrotask(() => {
          isCreatingTempNode.current = false;
        });
        return newNodes;
      });
    } else {
      setNodes(updater);
      queueMicrotask(() => {
        isCreatingTempNode.current = false;
      });
    }
  }, [setNodes]);

  return setNodesWithLog;
}
