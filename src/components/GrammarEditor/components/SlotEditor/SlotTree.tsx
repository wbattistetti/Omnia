// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { ArrowRight, Box, Pencil, MessageSquare, MoreHorizontal } from 'lucide-react';
import { SlotTreeNode } from './SlotTreeNode';
import { AddNode } from './AddNode';
import type { TreeNode } from '../../types/slotEditorTypes';
import type { Theme } from './styles';
import {
  validateSlotName,
  validateSemanticSetName,
  validateSemanticValue,
  validateLinguisticValue,
  suggestSynonyms,
} from '../../core/domain/slotEditor';
import type { SemanticSlot, SemanticSet, SemanticValue } from '../../types/grammarTypes';

interface SlotTreeProps {
  tree: TreeNode[];
  expanded: Set<string>;
  selected: string | null;
  onToggleExpanded: (id: string) => void;
  onSelect: (id: string) => void;
  onCreateSlot: (name: string) => void;
  onCreateSemanticSet: (name: string) => void;
  onCreateSemanticValue: (setId: string, value: string) => void;
  onCreateLinguisticValue: (setId: string, valueId: string, synonym: string) => void;
  slots: SemanticSlot[];
  semanticSets: SemanticSet[];
  theme: Theme;
  autoEditKey?: string | null;
  onAutoEditComplete?: () => void;
}

/**
 * Tree renderer component
 * Single Responsibility: Rendering hierarchical tree structure
 */
export function SlotTree({
  tree,
  expanded,
  selected,
  onToggleExpanded,
  onSelect,
  onCreateSlot,
  onCreateSemanticSet,
  onCreateSemanticValue,
  onCreateLinguisticValue,
  slots,
  semanticSets,
  theme,
  autoEditKey,
  onAutoEditComplete,
}: SlotTreeProps) {
  const renderNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expanded.has(node.id);
    const isSelected = selected === node.id;
    const hasChildren = node.children && node.children.length > 0;

    // Handle different node types
    if (node.type === 'slot') {
      const slot = node.data as SemanticSlot;
      if (!slot) {
        // Section header - NO ICON
        return (
          <SlotTreeNode
            icon={null}
            label={node.label}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            onToggle={() => onToggleExpanded(node.id)}
            onSelect={() => onSelect(node.id)}
            isSelected={isSelected}
            level={node.level}
            theme={theme}
          >
            {isExpanded && (
              <>
                {node.children?.map((child) => (
                  <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
                ))}
                <AddNode
                  placeholder="Add new slot..."
                  onAdd={(name) => onCreateSlot(name)}
                  level={node.level + 1}
                  theme={theme}
                  iconType="arrow"
                  validation={(value) => validateSlotName(value, slots)}
                />
              </>
            )}
          </SlotTreeNode>
        );
      }

      // Actual slot node
      return (
        <SlotTreeNode
          icon={<ArrowRight size={14} color="#10b981" />}
          label={slot.name}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          onToggle={() => onToggleExpanded(node.id)}
          onSelect={() => onSelect(node.id)}
          isSelected={isSelected}
          level={node.level}
          theme={theme}
        >
          {isExpanded && node.children?.map((child) => renderNode(child))}
        </SlotTreeNode>
      );
    }

    if (node.type === 'semantic-set') {
      const set = node.data as SemanticSet;
      if (!set) {
        // Section header - NO ICON
        return (
          <SlotTreeNode
            icon={null}
            label={node.label}
            isExpanded={isExpanded}
            hasChildren={hasChildren}
            onToggle={() => onToggleExpanded(node.id)}
            onSelect={() => onSelect(node.id)}
            isSelected={isSelected}
            level={node.level}
            theme={theme}
          >
            {isExpanded && (
              <>
                {node.children?.map((child) => (
                  <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
                ))}
                <AddNode
                  placeholder="Add new semantic set..."
                  onAdd={(name) => onCreateSemanticSet(name)}
                  level={node.level + 1}
                  theme={theme}
                  iconType="box"
                  validation={(value) => validateSemanticSetName(value, semanticSets)}
                />
              </>
            )}
          </SlotTreeNode>
        );
      }

      // Actual semantic set node
      // Always expandable (hasChildren=true) because it always has AddNode for semantic values
      return (
        <SlotTreeNode
          icon={<Box size={14} color="#fbbf24" />}
          label={node.label}
          isExpanded={isExpanded}
          hasChildren={true}
          onToggle={() => onToggleExpanded(node.id)}
          onSelect={() => onSelect(node.id)}
          isSelected={isSelected}
          level={node.level}
          theme={theme}
        >
          {isExpanded && (
            <>
              {node.children?.map((child) => (
                <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
              ))}
              <AddNode
                placeholder="Add new semantic value..."
                onAdd={(value) => onCreateSemanticValue(set.id, value)}
                level={node.level + 1}
                theme={theme}
                iconType="pencil"
                autoEditKey={`semantic-value-${set.id}`}
                currentAutoEditKey={autoEditKey}
                onAutoEditComplete={onAutoEditComplete}
                validation={(value) => validateSemanticValue(value, set.values)}
              />
            </>
          )}
        </SlotTreeNode>
      );
    }

    if (node.type === 'semantic-value') {
      const value = node.data as SemanticValue;
      if (!value) return null;

      return (
        <SlotTreeNode
          icon={<Pencil size={14} color="#fb923c" />}
          label={node.label}
          isExpanded={isExpanded}
          hasChildren={true}
          onToggle={() => onToggleExpanded(node.id)}
          onSelect={() => onSelect(node.id)}
          isSelected={isSelected}
          level={node.level}
          theme={theme}
        >
          {isExpanded && (
            <>
              {node.children?.map((child) => (
                <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
              ))}
              <AddNode
                placeholder="Add new synonym..."
                onAdd={(synonym) => {
                  const setId = node.parentId?.replace('set-', '') || '';
                  onCreateLinguisticValue(setId, value.id, synonym);
                }}
                level={node.level + 1}
                theme={theme}
                iconType="message"
                autoEditKey={`linguistic-value-${value.id}`}
                currentAutoEditKey={autoEditKey}
                onAutoEditComplete={onAutoEditComplete}
                validation={(synonym) => validateLinguisticValue(synonym, value.synonyms)}
                suggestions={(synonym) => {
                  const set = semanticSets.find((s) => s.values.some((v) => v.id === value.id));
                  if (!set) return [];
                  return suggestSynonyms(synonym, set.values);
                }}
              />
            </>
          )}
        </SlotTreeNode>
      );
    }

    if (node.type === 'linguistic-value') {
      const synonym = node.data as string;
      if (!synonym) return null;

      return (
        <SlotTreeNode
          icon={<MessageSquare size={14} color="#fde047" />}
          label={node.label}
          isExpanded={false}
          hasChildren={false}
          onToggle={() => {}}
          onSelect={() => onSelect(node.id)}
          isSelected={isSelected}
          level={node.level}
          theme={theme}
          labelColor="#3b82f6"
        />
      );
    }

    return null;
  };

  return (
    <div style={{ width: '100%' }}>
      {tree.map((node) => (
        <div key={node.id}>{renderNode(node)}</div>
      ))}
    </div>
  );
}
