// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ArrowRight, Box, Pencil } from 'lucide-react';
import type { GrammarNode as GrammarNodeType } from '../types/grammarTypes';
import { useNodeEditingState } from '../hooks/useNodeEditingState';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';
import { useNodeCreation } from '../features/node-creation/useNodeCreation';
import { useEdgeInteractions } from '../hooks/useEdgeInteractions';
import { useGrammarStore } from '../core/state/grammarStore';
import { isFloatingNode } from '../core/domain/grammar';
import { NODE_PLACEHOLDER, NODE_FONT, NODE_PADDING_H, NODE_MIN_WIDTH } from '../constants/nodeConstants';
import { measureText, calculateNodeWidth } from '../utils/nodeGeometry';
import {
  getNodeBackground, getBorderColor, getHighestBinding, getBindingIconColor,
  nodeBaseStyles, nodeLabelStyles, nodeMetadataStyles,
} from '../utils/nodeStyles';
import { NodeToolbar } from './NodeToolbar';
import { BindingTooltip } from './BindingTooltip';
import { WordsEditor } from './WordsEditor';
import { useDrag } from '../context/DragContext';
import { EditableText } from '../../common/EditableText';

interface GrammarNodeData {
  node: GrammarNodeType;
}

/**
 * Grammar node component.
 * Single Responsibility: Rendering and composition of editing hooks.
 *
 * Focus strategy:
 * - New nodes: focus is handled in creation handlers (useGrammarCanvasEvents, useNodeKeyboardHandlers)
 * - Existing nodes (double-click): useLayoutEffect in useNodeEditingState for immediate focus
 *
 * Toolbar: shown only on hover (not during editing) to avoid clutter.
 */
export function GrammarNode({ data, selected }: NodeProps<GrammarNodeData>) {
  const { node } = data;
  const { editNodeLabel } = useNodeEditing();
  const { deleteNode, getSlot, getNode, grammar } = useGrammarStore();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isWordsEditorOpen, setIsWordsEditorOpen] = React.useState(false);
  const { setDragState } = useDrag();
  const { screenToFlowPosition } = useReactFlow();

  const {
    isEditing, editValue, setEditValue,
    inputRef, startEditing, stopEditing, resetValue,
  } = useNodeEditingState(node.label);

  const { createNodeAfterFloating } = useNodeCreation();
  const { handleEdgeCreate } = useEdgeInteractions();

  // Handle save: save label and potentially create new node if floating
  const handleSave = React.useCallback((newLabel: string) => {
    const trimmedValue = newLabel.trim();

    console.log('[GrammarNode] 💾 handleSave called', {
      nodeId: node.id,
      newLabel,
      trimmedValue,
      currentLabel: node.label,
    });

    // Always save the current node label if not empty
    if (trimmedValue) {
      editNodeLabel(node.id, trimmedValue);
      console.log('[GrammarNode] ✅ Label saved', {
        nodeId: node.id,
        newLabel: trimmedValue,
      });
    }

    stopEditing();

    // Use requestAnimationFrame to ensure store is updated before checking if floating
    // This is necessary because React state updates might not be synchronous
    requestAnimationFrame(() => {
      const updatedGrammar = useGrammarStore.getState().grammar;
      const currentNode = updatedGrammar ? updatedGrammar.nodes.find(n => n.id === node.id) : undefined;

      if (updatedGrammar && currentNode) {
        const shouldCreateNewNode = isFloatingNode(
          updatedGrammar,
          currentNode,
          false, // not editing anymore
          trimmedValue // use saved label
        );

        console.log('[GrammarNode] 🔍 Checking if should create new node', {
          nodeId: node.id,
          shouldCreateNewNode,
          currentNodeLabel: currentNode.label,
          hasDescendants: updatedGrammar.edges.some(e => e.source === node.id),
        });

        // If node was floating, create new node after it
        if (shouldCreateNewNode) {
          const newNode = createNodeAfterFloating(currentNode, trimmedValue || undefined);
          if (newNode) {
            handleEdgeCreate(node.id, newNode.id, 'sequential');

            // New node will automatically enter editing mode via useNodeEditingState (isNew = true)
            // Focus is handled by useLayoutEffect in useNodeEditingState
          }
        }
      }
    });
  }, [node.id, node.label, editNodeLabel, stopEditing, createNodeAfterFloating, handleEdgeCreate]);

  const handleCancel = React.useCallback(() => {
    resetValue();
  }, [resetValue]);

  // Handle blur: if empty, delete floating node; otherwise save (like Enter)
  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Use a small delay to check if focus moved to another element in the same component
    // This prevents blur from firing when clicking action buttons
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
      // Focus moved within the same component, ignore blur
      return;
    }

    const trimmedValue = editValue.trim();

    // If text is not empty, save (like Enter) - don't cancel
    if (trimmedValue) {
      console.log('[GrammarNode] 💾 Blur with text, saving...', {
        nodeId: node.id,
        trimmedValue,
        editValue,
      });
      // Save immediately - this will update the node label in the store
      editNodeLabel(node.id, trimmedValue);
      stopEditing();
      // Don't create new node on blur - only on Enter
      return;
    }

    // If text is empty, check if node is floating (new, no descendants)
    const currentNode = grammar ? getNode(node.id) : undefined;
    if (grammar && currentNode) {
      const isFloating = isFloatingNode(
        grammar,
        currentNode,
        true, // is editing
        editValue // use current edit value
      );

      console.log('[GrammarNode] 🗑️ Blur with empty text', {
        nodeId: node.id,
        isFloating,
        hasDescendants: grammar.edges.some(e => e.source === node.id),
      });

      // If floating and empty, delete the node
      if (isFloating) {
        console.log('[GrammarNode] 🗑️ Deleting floating empty node', { nodeId: node.id });
        deleteNode(node.id);
        stopEditing();
        return;
      }
    }

    // If empty but not floating, just cancel editing (don't delete)
    console.log('[GrammarNode] ❌ Blur with empty text but not floating, canceling...', {
      nodeId: node.id,
    });
    handleCancel();
  }, [editValue, grammar, getNode, node.id, deleteNode, stopEditing, editNodeLabel, handleCancel]);

  // Custom key handler that integrates EditableText with node creation logic
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter: save and potentially create new node
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSave(editValue);
    }
    // Handle Escape: cancel editing (and potentially delete floating node)
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();

      // Check if node is floating (new, empty, no descendants)
      const currentNode = grammar ? getNode(node.id) : undefined;
      if (grammar && currentNode) {
        const isFloating = isFloatingNode(
          grammar,
          currentNode,
          true, // is editing
          editValue // use current edit value
        );

        // If floating and empty, delete the node
        if (isFloating && !editValue.trim()) {
          deleteNode(node.id);
          stopEditing();
          return;
        }
      }

      handleCancel();
    }
  }, [editValue, handleSave, handleCancel, grammar, getNode, node.id, deleteNode, stopEditing]);

  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const nodeElement = e.currentTarget.closest('.react-flow__node') as HTMLElement;
    if (!nodeElement) return;

    const rect = nodeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const flowPos = screenToFlowPosition({ x: centerX, y: centerY });

    setDragState({
      sourceNodeId: node.id,
      startPos: flowPos,
    });
  }, [node.id, screenToFlowPosition, setDragState]);

  // Get highest binding for icon and color
  const highestBinding = React.useMemo(() => getHighestBinding(node.bindings), [node.bindings]);
  const bindingIconColor = highestBinding ? getBindingIconColor(highestBinding.type) : null;

  // Calculate padding for icon (if binding exists)
  const iconPadding = highestBinding ? 18 : 0; // 12px icon + 6px spacing

  const inputWidth = React.useMemo(() => {
    const measured = measureText(editValue || NODE_PLACEHOLDER, NODE_FONT);
    return Math.max(measured + NODE_PADDING_H, NODE_MIN_WIDTH) + iconPadding;
  }, [editValue, iconPadding]);

  const labelWidth = React.useMemo(() => {
    return calculateNodeWidth(node.label) + iconPadding;
  }, [node.label, iconPadding]);

  // Get icon component for highest binding
  const getBindingIcon = () => {
    if (!highestBinding) return null;

    const iconSize = 12;
    const iconColor = bindingIconColor || '#c9d1d9';

    switch (highestBinding.type) {
      case 'slot':
        return <ArrowRight size={iconSize} color={iconColor} />;
      case 'semantic-set':
        return <Box size={iconSize} color={iconColor} />;
      case 'semantic-value':
        return <Pencil size={iconSize} color={iconColor} />;
      default:
        return null;
    }
  };

  const containerStyle: React.CSSProperties = {
    ...nodeBaseStyles,
    border: `1px solid ${getBorderColor(selected)}`,
    backgroundColor: getNodeBackground(node),
    width: isEditing ? `${inputWidth}px` : `${labelWidth}px`,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    paddingLeft: highestBinding ? `${iconPadding}px` : undefined,
  };

  return (
    <div
      data-node-id={node.id}  // For immediate focus after node creation
      style={containerStyle}
      onDoubleClick={startEditing}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Binding Tooltip: shows all bindings with remove buttons */}
      {isHovered && !isEditing && node.bindings.length > 0 && (
        <BindingTooltip nodeId={node.id} bindings={node.bindings} />
      )}

      {/* Toolbar: visible only on hover and when not editing */}
      {isHovered && !isEditing && (
        <NodeToolbar
          nodeId={node.id}
          onDelete={() => deleteNode(node.id)}
          onEditCaption={startEditing}
          onEditWords={() => setIsWordsEditorOpen(true)}
          onSetOptional={() => updateNode(node.id, { optional: !node.optional })}
          onSetRepetitions={() => updateNode(node.id, { repeatable: !node.repeatable })}
        />
      )}

      {/* Words Editor: shown when Edit Words is clicked */}
      {isWordsEditorOpen && (
        <WordsEditor
          nodeId={node.id}
          synonyms={node.synonyms}
          onClose={() => setIsWordsEditorOpen(false)}
        />
      )}

      <Handle type="target" position={Position.Left} style={{ width: 6, height: 6 }} />

      {/* Center drag handle - appears on hover */}
      {isHovered && !isEditing && (
        <div
          className="nodrag"
          data-drag-handle="link"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#4a9eff',
            border: '2px solid #1a1f2e',
            cursor: 'crosshair',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
          onMouseDown={handleDragStart}
          onMouseEnter={(e) => {
            e.currentTarget.style.cursor = 'crosshair';
          }}
          title="Drag to create edge and new node"
        />
      )}

      {/* Icon for highest binding - shown on the left */}
      {!isEditing && highestBinding && (
        <div
          style={{
            position: 'absolute',
            left: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          {getBindingIcon()}
        </div>
      )}

      {isEditing ? (
        <EditableText
          ref={inputRef}
          value={editValue}
          editing={isEditing}
          onSave={handleSave}
          onCancel={handleCancel}
          onStartEditing={startEditing}
          placeholder={NODE_PLACEHOLDER}
          showActionButtons={false}
          expectedLanguage="it"
          showLanguageWarning={false}
          enableVoice={true}
          micSize={10}
          micBackground="transparent"
          multiline={false}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{
            width: '100%',
            minWidth: `${inputWidth}px`,
            textAlign: 'center',
            // Remove border (node already has border)
            border: 'none',
            outline: 'none',
            // Reduce height
            padding: '2px 4px',
            height: 'auto',
            minHeight: '20px',
            lineHeight: '1.2',
            // Transparent background to match node
            background: 'transparent',
            color: '#c9d1d9', // Match node text color
          }}
        />
      ) : (
        <span style={nodeLabelStyles}>{node.label}</span>
      )}

      {!isEditing && (() => {
        const slotBinding = node.bindings.find(b => b.type === 'slot');
        if (slotBinding && slotBinding.type === 'slot') {
          const slot = getSlot(slotBinding.slotId);
          // Only show metadata if slot name is different from node label (to avoid duplication)
          if (slot && slot.name !== node.label) {
            return <div style={nodeMetadataStyles.slot}>→ {slot.name}</div>;
          }
        }
        return null;
      })()}
      {!isEditing && node.optional && (
        <div style={nodeMetadataStyles.optional}>(opt)</div>
      )}

      <Handle type="source" position={Position.Right} style={{ width: 6, height: 6 }} />
    </div>
  );
}

// Re-export for backward compatibility
export { calculateNodeWidth, getNodeRight } from '../utils/nodeGeometry';
