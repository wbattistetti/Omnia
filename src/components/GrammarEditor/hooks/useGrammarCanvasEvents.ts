// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import type { NodeChange, Connection } from 'reactflow';
import { useGrammarStore } from '../core/state/grammarStore';
import { createGrammarNode, addBinding } from '../core/domain/node';
import { generateSafeGuid } from '@utils/idGenerator';
import type { GrammarEdge, NodeBinding } from '../types/grammarTypes';
import { ESTIMATED_NODE_WIDTH, ESTIMATED_NODE_HEIGHT } from '../constants/nodeConstants';
import { useDrag } from '../context/DragContext';

/**
 * Hook for handling canvas-level events.
 * Single Responsibility: Event handling only.
 */
export function useGrammarCanvasEvents() {
  const rf = useReactFlow();
  const { grammar, addNode, addEdge, updateNode, selectNode, clearSelection } = useGrammarStore();
  const { dragState, setDragState } = useDrag();

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      console.log('[GrammarCanvas] 🔍 handlePaneDoubleClick CALLED', {
        hasRf: !!rf,
        hasGrammar: !!grammar,
        grammarId: grammar?.id,
        eventType: event.type,
        target: (event.target as HTMLElement)?.tagName,
      });

      event.preventDefault();
      event.stopPropagation();

      if (!rf) {
        console.error('[GrammarCanvas] ❌ ReactFlow instance not available');
        return;
      }

      if (!grammar) {
        console.error('[GrammarCanvas] ❌ Grammar not loaded, cannot create node', {
          hasGrammar: !!grammar,
          grammarId: grammar?.id,
        });
        return;
      }

      const clickPos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const centeredPos = {
        x: clickPos.x - ESTIMATED_NODE_WIDTH / 2,
        y: clickPos.y - ESTIMATED_NODE_HEIGHT / 2,
      };

      console.log('[GrammarCanvas] ✅ Creating node at position', {
        clickPos,
        centeredPos,
        grammarId: grammar.id,
        nodesCount: grammar.nodes.length,
      });

      const newNode = createGrammarNode('', centeredPos);
      console.log('[GrammarCanvas] 📝 Calling addNode', {
        newNodeId: newNode.id,
        newNodeLabel: newNode.label,
        newNodePosition: newNode.position,
      });
      addNode(newNode);
      clearSelection(); // ✅ CRITICAL: Prevent React Flow from auto-selecting new node
      console.log('[GrammarCanvas] ✅ addNode called successfully');

      // Node will automatically enter editing mode via useNodeEditingState (label === '')
      // Focus is handled by useLayoutEffect in useNodeEditingState
    },
    [rf, addNode, grammar, clearSelection]
  );

  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // ✅ CRITICAL: Don't process changes if any node is in editing mode
      // This prevents React Flow from stealing focus during editing
      const editingNode = document.querySelector('[data-editing="true"]');
      if (editingNode) {
        return; // Ignore changes during editing to prevent focus loss
      }

      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        }
      });
    },
    [updateNode]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !grammar) return;

      const edge: GrammarEdge = {
        id: generateSafeGuid(),
        source: connection.source,
        target: connection.target,
        type: 'sequential',
      };
      addEdge(edge);
    },
    [addEdge, grammar]
  );

  const handlePaneMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (!dragState || !rf || !grammar) return;

      const dropPos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const centeredPos = {
        x: dropPos.x - ESTIMATED_NODE_WIDTH / 2,
        y: dropPos.y - ESTIMATED_NODE_HEIGHT / 2,
      };

      const newNode = createGrammarNode('', centeredPos);
      addNode(newNode);
      clearSelection(); // ✅ CRITICAL: Prevent React Flow from auto-selecting new node

      const edge: GrammarEdge = {
        id: generateSafeGuid(),
        source: dragState.sourceNodeId,
        target: newNode.id,
        type: 'sequential',
      };
      addEdge(edge);

      setDragState(null);

      // Node will automatically enter editing mode via useNodeEditingState (label === '')
      // Focus is handled by useLayoutEffect in useNodeEditingState
    },
    [dragState, rf, grammar, addNode, addEdge, setDragState, clearSelection]
  );

  // Cancel drag on escape or mouseup anywhere (if not on canvas)
  React.useEffect(() => {
    if (!dragState) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOnCanvas = target?.closest('.grammar-canvas') || target?.closest('.react-flow');
      if (!isOnCanvas) {
        setDragState(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, setDragState]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      // ✅ CRITICAL: Don't select node if it's in editing mode
      // Check if the node is in editing by looking for input/textarea or data-editing attribute
      const target = event.target as HTMLElement;
      const isEditing = !!target?.closest('input, textarea') ||
                        !!target?.closest('[data-editing="true"]');

      if (isEditing) {
        event.stopPropagation();
        return; // Don't select during editing to preserve focus
      }

      selectNode(node.id);
    },
    [selectNode]
  );

  // Cancel drag on escape
  React.useEffect(() => {
    if (!dragState) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dragState, setDragState]);

  // Handle drop from Slot Editor to create new node with binding or add binding to existing node
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!rf || !grammar) return;

      // Check if data is from Slot Editor
      const dataStr = event.dataTransfer.getData('application/json');
      if (!dataStr) return; // Not from Slot Editor

      try {
        const data = JSON.parse(dataStr);
        if (!data.type || !['slot', 'semantic-set', 'semantic-value'].includes(data.type)) {
          return; // Invalid drag data
        }

        // Create binding based on type
        let binding: NodeBinding;
        if (data.type === 'slot') {
          binding = { type: 'slot', slotId: data.slotId };
        } else if (data.type === 'semantic-set') {
          binding = { type: 'semantic-set', setId: data.setId };
        } else {
          binding = { type: 'semantic-value', valueId: data.valueId };
        }

        // Check if drop is on an existing node
        const target = event.target as HTMLElement;
        const nodeElement = target?.closest('.react-flow__node') as HTMLElement;

        if (nodeElement) {
          // Drop on existing node: find the node ID
          // ReactFlow wraps our node, so we need to find data-node-id inside
          const nodeIdElement = nodeElement.querySelector('[data-node-id]') as HTMLElement;
          const nodeId = nodeIdElement?.getAttribute('data-node-id');

          if (nodeId) {
            const existingNode = grammar.nodes.find(n => n.id === nodeId);
            if (existingNode) {
              const result = addBinding(existingNode, binding);
              if (result.isValid) {
                updateNode(nodeId, result.node);
              } else if (result.error) {
                window.alert(result.error);
              }
              return; // Done, don't create new node
            }
          }
        }

        // Drop on canvas: create new node with binding
        const dropPos = rf.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const centeredPos = {
          x: dropPos.x - ESTIMATED_NODE_WIDTH / 2,
          y: dropPos.y - ESTIMATED_NODE_HEIGHT / 2,
        };

        const initialLabel =
          binding.type === 'semantic-set' ? '' : (data.label || '');
        const newNode = createGrammarNode(initialLabel, centeredPos, [binding]);
        addNode(newNode);
        clearSelection(); // ✅ CRITICAL: Prevent React Flow from auto-selecting new node

        // Node will automatically enter editing mode via useNodeEditingState (isNew = true)
        // Focus is handled by useLayoutEffect in useNodeEditingState
      } catch (error) {
        console.error('Error handling drop:', error);
      }
    },
    [rf, grammar, addNode, updateNode, clearSelection]
  );

  // Handle drag over to allow drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Check if data is from Slot Editor
    const dataStr = event.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.type && ['slot', 'semantic-set', 'semantic-value'].includes(data.type)) {
          event.dataTransfer.dropEffect = 'copy';
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  return {
    handlePaneDoubleClick,
    handlePaneClick,
    handleNodesChange,
    handleConnect,
    handleNodeClick,
    handlePaneMouseUp,
    handleDrop,
    handleDragOver,
  };
}
