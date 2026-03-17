// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { GrammarNode, NodeBinding } from '../types/grammarTypes';

/**
 * Node styling utilities.
 * Centralized styling logic for consistency.
 */

/**
 * Binding hierarchy: slot (highest) > semantic-set > semantic-value (lowest)
 */
export function getHighestBinding(bindings: NodeBinding[]): NodeBinding | null {
  if (bindings.length === 0) return null;

  // Check for slot (highest priority)
  const slot = bindings.find(b => b.type === 'slot');
  if (slot) return slot;

  // Check for semantic set
  const set = bindings.find(b => b.type === 'semantic-set');
  if (set) return set;

  // Check for semantic value
  const value = bindings.find(b => b.type === 'semantic-value');
  if (value) return value;

  return null;
}

/**
 * Gets the highest binding for VISUAL DISPLAY only.
 * INCLUDES slots (they have highest priority for icon display).
 * Binding hierarchy: slot (highest) > semantic-set > semantic-value (lowest)
 */
export function getHighestBindingForDisplay(bindings: NodeBinding[]): NodeBinding | null {
  if (bindings.length === 0) return null;

  // ✅ Slots have highest priority for icon display
  const slot = bindings.find(b => b.type === 'slot');
  if (slot) return slot;

  // Check for semantic set
  const set = bindings.find(b => b.type === 'semantic-set');
  if (set) return set;

  // Check for semantic value
  const value = bindings.find(b => b.type === 'semantic-value');
  if (value) return value;

  return null;
}

/**
 * Gets the icon color for a binding type.
 * Colors match Slot Editor icons.
 */
export function getBindingIconColor(bindingType: NodeBinding['type']): string {
  switch (bindingType) {
    case 'slot':
      return '#10b981'; // Green (ArrowRight)
    case 'semantic-set':
      return '#fbbf24'; // Yellow (Box)
    case 'semantic-value':
      return '#fb923c'; // Orange (Pencil)
    default:
      return '#1a1f2e';
  }
}

/**
 * Gets the background color for a node based on its highest binding.
 * Uses the icon color with 50% opacity (rgba).
 * ✅ Now includes slots (they have highest priority).
 */
export function getNodeBackground(node: GrammarNode): string {
  const highestBinding = getHighestBindingForDisplay(node.bindings);

  if (!highestBinding) {
    return '#1a1f2e'; // Default dark background
  }

  const iconColor = getBindingIconColor(highestBinding.type);

  // Convert hex to rgba with 50% opacity
  // Remove # if present
  const hex = iconColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, 0.5)`;
}

/**
 * Gets the border color for a node based on selection state.
 */
export function getBorderColor(selected: boolean): string {
  return selected ? '#3b82f6' : '#4a5568';
}

/**
 * Base styles for node container.
 */
export const nodeBaseStyles: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: '3px',
  fontSize: '13px',
  fontFamily: 'sans-serif',
  textAlign: 'center',
  lineHeight: '1.4',
  color: '#c9d1d9',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap',
  overflow: 'visible', // Must be visible so the absolute-positioned toolbar above is not clipped
};

/**
 * Base styles for node input field.
 */
export const nodeInputStyles: React.CSSProperties = {
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
};

/**
 * Styles for node label text.
 */
export const nodeLabelStyles: React.CSSProperties = {
  fontSize: '13px',
  fontFamily: 'sans-serif',
  color: '#c9d1d9',
};

/**
 * Styles for node metadata (synonyms, slot, optional).
 */
export const nodeMetadataStyles = {
  synonyms: {
    fontSize: '8px',
    color: '#6b7280',
    marginTop: '1px',
  } as React.CSSProperties,
  slot: {
    fontSize: '8px',
    color: '#059669',
    marginTop: '1px',
  } as React.CSSProperties,
  optional: {
    fontSize: '7px',
    color: '#dc2626',
    marginTop: '1px',
  } as React.CSSProperties,
};
