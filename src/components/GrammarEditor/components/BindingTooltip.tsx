// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { ArrowRight, Box, Pencil, Trash2 } from 'lucide-react';
import type { NodeBinding } from '../types/grammarTypes';
import { getBindingIconColor } from '../utils/nodeStyles';
import { useGrammarStore } from '../core/state/grammarStore';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';

interface BindingTooltipProps {
  nodeId: string;
  bindings: NodeBinding[];
}

/**
 * Tooltip that displays all bindings for a node on hover.
 * Shows icon + name for each binding, with a trash icon to remove it.
 */
export function BindingTooltip({ nodeId, bindings }: BindingTooltipProps) {
  const { getSlot, getSemanticSet, grammar } = useGrammarStore();
  const { removeNodeBinding } = useNodeEditing();

  if (bindings.length === 0) return null;

  const getBindingIcon = (binding: NodeBinding) => {
    const iconSize = 12;
    const iconColor = getBindingIconColor(binding.type);

    switch (binding.type) {
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

  const getBindingName = (binding: NodeBinding): string => {
    switch (binding.type) {
      case 'slot': {
        const slot = getSlot(binding.slotId);
        return slot?.name || binding.slotId;
      }
      case 'semantic-set': {
        const set = getSemanticSet(binding.setId);
        return set?.name || binding.setId;
      }
      case 'semantic-value': {
        // Search all semantic sets for this value
        if (!grammar) return binding.valueId;

        for (const set of grammar.semanticSets) {
          const value = set.values.find(v => v.id === binding.valueId);
          if (value) return value.value;
        }
        return binding.valueId;
      }
      default:
        return '';
    }
  };

  const handleRemoveBinding = (
    e: React.MouseEvent,
    binding: NodeBinding
  ) => {
    e.stopPropagation();
    if (binding.type === 'slot') {
      removeNodeBinding(nodeId, 'slot', binding.slotId);
    } else if (binding.type === 'semantic-set') {
      removeNodeBinding(nodeId, 'semantic-set', binding.setId);
    } else {
      removeNodeBinding(nodeId, 'semantic-value', binding.valueId);
    }
  };

  return (
    <div
      style={tooltipContainerStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {bindings.map((binding, index) => {
        const name = getBindingName(binding);
        return (
          <div key={index} style={bindingItemStyle}>
            <div style={bindingContentStyle}>
              {getBindingIcon(binding)}
              <span style={bindingNameStyle}>{name}</span>
            </div>
            <button
              style={trashButtonStyle}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleRemoveBinding(e, binding)}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6b7280';
              }}
              title={`Remove ${name}`}
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const tooltipContainerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  zIndex: 20,
  backgroundColor: '#1a1f2e',
  borderRadius: '4px',
  padding: '4px',
  border: '1px solid #4a5568',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  minWidth: '120px',
};

const bindingItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '6px',
  padding: '2px 4px',
  borderRadius: '2px',
};

const bindingContentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flex: 1,
};

const bindingNameStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#c9d1d9',
  fontFamily: 'sans-serif',
};

const trashButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6b7280',
  borderRadius: '2px',
  flexShrink: 0,
};
