import { useRef, useCallback } from 'react';
import type { Node } from 'reactflow';
import type { NodeData } from '../types/flowTypes';

export function useNodesWithLog(setNodes: (updater: any) => void) {
  const isCreatingTempNode = useRef(false);

  const setNodesWithLog = useCallback((updater: any) => {
    // Allow stabilization updates (removing isTemporary flag) even if lock is active
    if (isCreatingTempNode.current) {
      if (typeof updater === 'function') {
        // Check if this update is for stabilization (removing isTemporary)
        const currentNodes = []; // We can't access current nodes here, so we need a different approach
        console.log("⚠️ [SET_NODES] Lock active, but allowing potential stabilization update");
      } else {
        console.log("🚫 [SET_NODES] BLOCKED - Node creation already in progress");
        return;
      }
    }

    isCreatingTempNode.current = true;

    if (typeof updater === 'function') {
      setNodes((currentNodes: Node<NodeData>[]) => {
        const newNodes = updater(currentNodes);

        // Check if this is a stabilization update (removing isTemporary flag)
        const isStabilizationUpdate = currentNodes.some(node =>
          (node.data as any)?.isTemporary &&
          newNodes.find(n => n.id === node.id && !(n.data as any)?.isTemporary)
        );

        // If this is a stabilization update, release the lock immediately
        if (isStabilizationUpdate) {
          console.log("✅ [SET_NODES] Stabilization update detected, releasing lock");
          isCreatingTempNode.current = false;
        }

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

        // Release lock after microtask unless it's already been released for stabilization
        if (!isStabilizationUpdate) {
          queueMicrotask(() => {
            isCreatingTempNode.current = false;
          });
        }

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
