// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ArrowRight, Box, Pencil } from 'lucide-react';
import type { GrammarNode as GrammarNodeType } from '../types/grammarTypes';
import { useNodeEditingState } from '../hooks/useNodeEditingState';
import { useNodeKeyboardHandlers } from '../hooks/useNodeKeyboardHandlers';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';
import { useGrammarStore } from '../core/state/grammarStore';
import { NODE_PLACEHOLDER, NODE_FONT, NODE_PADDING_H, NODE_MIN_WIDTH } from '../constants/nodeConstants';
import { measureText, calculateNodeWidth } from '../utils/nodeGeometry';
import {
  getNodeBackground, getBorderColor, getHighestBinding, getBindingIconColor,
  nodeBaseStyles, nodeInputStyles, nodeLabelStyles, nodeMetadataStyles,
} from '../utils/nodeStyles';
import { NodeToolbar } from './NodeToolbar';
import { useDrag } from '../context/DragContext';

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
  const { deleteNode, updateNode, getSlot } = useGrammarStore();
  const [isHovered, setIsHovered] = React.useState(false);
  const { setDragState } = useDrag();
  const { screenToFlowPosition } = useReactFlow();

  const {
    isEditing, editValue, setEditValue,
    inputRef, startEditing, stopEditing, resetValue,
  } = useNodeEditingState(node.label);

  const { handleKeyDown } = useNodeKeyboardHandlers({
    nodeId: node.id,
    editValue,
    isEditing,
    onSave: () => {},
    onCancel: resetValue,
    onStopEditing: stopEditing,
  });

  const handleBlur = () => {
    if (editValue.trim()) editNodeLabel(node.id, editValue.trim());
    stopEditing();
  };

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
      {/* Toolbar: visible only on hover and when not editing */}
      {isHovered && !isEditing && (
        <NodeToolbar
          nodeId={node.id}
          onDelete={() => deleteNode(node.id)}
          onEditCaption={startEditing}
          onSetOptional={() => updateNode(node.id, { optional: !node.optional })}
          onSetRepetitions={() => updateNode(node.id, { repeatable: !node.repeatable })}
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
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onDoubleClick={(e) => e.stopPropagation()}
          style={nodeInputStyles}
          placeholder={NODE_PLACEHOLDER}
        />
      ) : (
        <span style={nodeLabelStyles}>{node.label}</span>
      )}

      {!isEditing && node.synonyms.length > 0 && (
        <div style={nodeMetadataStyles.synonyms}>
          {node.synonyms.slice(0, 2).join(', ')}
          {node.synonyms.length > 2 && '...'}
        </div>
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
