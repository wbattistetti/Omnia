// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { GrammarNode as GrammarNodeType } from '../types/grammarTypes';
import { useNodeEditingState } from '../hooks/useNodeEditingState';
import { useNodeKeyboardHandlers } from '../hooks/useNodeKeyboardHandlers';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';
import { useGrammarStore } from '../core/state/grammarStore';
import { NODE_PLACEHOLDER, NODE_FONT, NODE_PADDING_H, NODE_MIN_WIDTH } from '../constants/nodeConstants';
import { measureText, calculateNodeWidth } from '../utils/nodeGeometry';
import {
  getNodeBackground, getBorderColor,
  nodeBaseStyles, nodeInputStyles, nodeLabelStyles, nodeMetadataStyles,
} from '../utils/nodeStyles';
import { NodeToolbar } from './NodeToolbar';

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
  const { deleteNode, updateNode } = useGrammarStore();
  const [isHovered, setIsHovered] = React.useState(false);

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

  const inputWidth = React.useMemo(() => {
    const measured = measureText(editValue || NODE_PLACEHOLDER, NODE_FONT);
    return Math.max(measured + NODE_PADDING_H, NODE_MIN_WIDTH);
  }, [editValue]);

  const labelWidth = React.useMemo(() => calculateNodeWidth(node.label), [node.label]);

  const containerStyle: React.CSSProperties = {
    ...nodeBaseStyles,
    border: `1px solid ${getBorderColor(selected)}`,
    backgroundColor: getNodeBackground(node.semanticType),
    width: isEditing ? `${inputWidth}px` : `${labelWidth}px`,
    position: 'relative',
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
      {!isEditing && node.slotId && (
        <div style={nodeMetadataStyles.slot}>→ {node.slotId}</div>
      )}
      {!isEditing && node.optional && (
        <div style={nodeMetadataStyles.optional}>(opt)</div>
      )}

      <Handle type="source" position={Position.Right} style={{ width: 6, height: 6 }} />
    </div>
  );
}

// Re-export for backward compatibility
export { calculateNodeWidth, getNodeRight } from '../utils/nodeGeometry';
