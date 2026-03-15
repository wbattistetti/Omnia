// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { GrammarNode as GrammarNodeType } from '../types/grammarTypes';
import { useNodeEditingState } from '../hooks/useNodeEditingState';
import { useNodeKeyboardHandlers } from '../hooks/useNodeKeyboardHandlers';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';

interface GrammarNodeData {
  node: GrammarNodeType;
}

export const NODE_FONT = '13px sans-serif';
export const NODE_PADDING_H = 12; // 6px left + 6px right
export const NODE_MIN_WIDTH = 32;
export const NODE_PLACEHOLDER = 'Type word...';

/**
 * Measures text width using Canvas API for accurate sizing.
 */
function measureText(text: string, font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return NODE_MIN_WIDTH;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Calculates the actual width of a node based on its label.
 * Uses the same logic as the GrammarNode component.
 */
export function calculateNodeWidth(label: string): number {
  if (!label) return NODE_MIN_WIDTH;
  const textWidth = measureText(label, NODE_FONT);
  return Math.max(textWidth + NODE_PADDING_H, NODE_MIN_WIDTH);
}

/**
 * Calculates the right edge (X coordinate) of a node.
 * Right = position.x + width
 */
export function getNodeRight(node: { position: { x: number; y: number }; label: string }): number {
  const nodeWidth = calculateNodeWidth(node.label);
  return node.position.x + nodeWidth;
}

/**
 * Grammar node component.
 * Single Responsibility: Rendering and composition of editing hooks.
 */
export function GrammarNode({ data, selected }: NodeProps<GrammarNodeData>) {
  const { node } = data;
  const { editNodeLabel } = useNodeEditing();
  const {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    stopEditing,
    resetValue,
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
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      editNodeLabel(node.id, trimmedValue);
    }
    stopEditing();
  };

  // Compute input width dynamically based on current text or placeholder.
  const inputWidth = React.useMemo(() => {
    const textToMeasure = editValue || NODE_PLACEHOLDER;
    const measured = measureText(textToMeasure, NODE_FONT);
    return Math.max(measured + NODE_PADDING_H, NODE_MIN_WIDTH);
  }, [editValue]);

  // Compute label width when not editing.
  const labelWidth = React.useMemo(() => {
    if (!node.label) return NODE_MIN_WIDTH;
    const measured = measureText(node.label, NODE_FONT);
    return Math.max(measured + NODE_PADDING_H, NODE_MIN_WIDTH);
  }, [node.label]);

  const getNodeBackground = (): string => {
    if (node.semanticType === 'value') return '#2a2010';
    if (node.semanticType === 'set') return '#1e2010';
    return '#1a1f2e';
  };

  const getBorderColor = (): string => {
    if (selected) return '#3b82f6';
    return '#4a5568';
  };

  return (
    <div
      style={{
        padding: '2px 6px',
        border: `1px solid ${getBorderColor()}`,
        borderRadius: '3px',
        backgroundColor: getNodeBackground(),
        width: isEditing ? `${inputWidth}px` : `${labelWidth}px`,
        fontSize: '13px',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        lineHeight: '1.4',
        color: '#c9d1d9',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
      onDoubleClick={startEditing}
    >
      <Handle type="target" position={Position.Left} style={{ width: 6, height: 6 }} />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            textAlign: 'center',
            fontWeight: 'normal',
            width: '100%',
            fontSize: '13px',
            fontFamily: 'sans-serif',
            padding: 0,
            margin: 0,
            cursor: 'text',
            color: '#c9d1d9',
          }}
          placeholder={NODE_PLACEHOLDER}
        />
      ) : (
        <span style={{ fontSize: '13px', fontFamily: 'sans-serif', color: '#c9d1d9' }}>
          {node.label}
        </span>
      )}

      {!isEditing && node.synonyms.length > 0 && (
        <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '1px' }}>
          {node.synonyms.slice(0, 2).join(', ')}
          {node.synonyms.length > 2 && '...'}
        </div>
      )}
      {!isEditing && node.slotId && (
        <div style={{ fontSize: '8px', color: '#059669', marginTop: '1px' }}>
          → {node.slotId}
        </div>
      )}
      {!isEditing && node.optional && (
        <div style={{ fontSize: '7px', color: '#dc2626', marginTop: '1px' }}>
          (opt)
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ width: 6, height: 6 }} />
    </div>
  );
}
