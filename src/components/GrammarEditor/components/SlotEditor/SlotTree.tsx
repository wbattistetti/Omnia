// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState } from 'react';
import { ArrowRight, Box, Pencil, MessageSquare, MoreHorizontal } from 'lucide-react';
import { SlotTreeNode } from './SlotTreeNode';
import { AddNode } from './AddNode';
import { EditableText } from '../../../common/EditableText';
import { useInlineEditing } from '../../hooks/SlotEditor/useInlineEditing';
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
  onUpdateSlot: (id: string, name: string) => void;
  onDeleteSlot: (id: string) => void;
  onUpdateSemanticSet: (id: string, name: string) => void;
  onDeleteSemanticSet: (id: string) => void;
  onUpdateSemanticValue: (setId: string, valueId: string, newValue: string) => void;
  onDeleteSemanticValue: (setId: string, valueId: string) => void;
  onUpdateLinguisticValue: (setId: string, valueId: string, oldSynonym: string, newSynonym: string) => void;
  onDeleteLinguisticValue: (setId: string, valueId: string, synonym: string) => void;
  slots: SemanticSlot[];
  semanticSets: SemanticSet[];
  theme: Theme;
  autoEditKey?: string | null;
  onAutoEditComplete?: () => void;
}

/**
 * Creates a custom drag image (icon + label pill) and attaches it to the drag event.
 * Forces a layout reflow so the browser can snapshot the element before it's removed.
 */
function attachDragImage(
  e: React.DragEvent,
  iconColor: string,
  iconPath: string,
  label: string,
): void {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:-200px',
    'left:-200px',
    'display:flex',
    'align-items:center',
    'gap:6px',
    'padding:4px 10px',
    'background:#1e293b',
    'border:1px solid #334155',
    'border-radius:4px',
    'font-size:13px',
    'color:#e5e7eb',
    'font-family:sans-serif',
    'white-space:nowrap',
    'pointer-events:none',
    'z-index:99999',
  ].join(';');
  el.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="${iconPath}"/>
    </svg>
    <span>${label}</span>
  `;
  document.body.appendChild(el);
  // Force layout reflow so the browser renders the element before setDragImage snapshot
  void el.getBoundingClientRect();
  e.dataTransfer.setDragImage(el, 0, 0);
  // Remove after drag image is captured (100ms is enough for all browsers)
  setTimeout(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
  }, 100);
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
  onUpdateSlot,
  onDeleteSlot,
  onUpdateSemanticSet,
  onDeleteSemanticSet,
  onUpdateSemanticValue,
  onDeleteSemanticValue,
  onUpdateLinguisticValue,
  onDeleteLinguisticValue,
  slots,
  semanticSets,
  theme,
  autoEditKey,
  onAutoEditComplete,
}: SlotTreeProps) {
  // Use inline editing hook for slots
  const slotEditing = useInlineEditing(slots, (slot) => slot.name);

  // Use inline editing hook for semantic sets
  const semanticSetEditing = useInlineEditing(semanticSets, (set) => set.name);

  const renderNode = (node: TreeNode): React.ReactNode => {
    // Section headers (node.data == null) respect the toggle state so users can
    // collapse the whole section. Actual data nodes (slots, sets, values) are
    // always expanded so the full hierarchy is always visible without any clicks.
    const isExpanded = node.data != null ? true : expanded.has(node.id);
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

      // Actual slot node - draggable
      const handleSlotDragStart = (e: React.DragEvent) => {
        if (slotEditing.isEditing(slot.id)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'slot',
          slotId: slot.id,
          label: slot.name,
        }));
        e.dataTransfer.effectAllowed = 'copy';
        attachDragImage(e, '#10b981', 'M5 12h14M12 5l7 7-7 7', slot.name);
      };

      const handleEditSlot = () => slotEditing.handleEdit(slot.id);
      const handleSaveSlot = (newName: string) => {
        if (!onUpdateSlot) {
          console.error('[SlotTree] onUpdateSlot is not defined');
          return;
        }
        onUpdateSlot(slot.id, newName);
        slotEditing.handleCancel();
      };
      const handleCancelEditSlot = () => slotEditing.handleCancel();
      const handleDeleteSlot = () => {
        if (window.confirm(`Delete slot "${slot.name}"?`)) {
          onDeleteSlot(slot.id);
        }
      };
      const isEditing = slotEditing.isEditing(slot.id);

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
          draggable={!isEditing}
          onDragStart={handleSlotDragStart}
          onEdit={handleEditSlot}
          onDelete={handleDeleteSlot}
          isEditing={isEditing}
          editingComponent={
            isEditing ? (
              <EditableText
                value={slotEditing.editingValue}
                editing={isEditing}
                onSave={handleSaveSlot}
                onCancel={handleCancelEditSlot}
                placeholder="Slot name..."
                showActionButtons={true}
                expectedLanguage="it"
                showLanguageWarning={true}
                enableVoice={true}
                multiline={false}
                validation={(value) => {
                  const result = validateSlotName(value, slots, slot.id);
                  return {
                    isValid: result.isValid,
                    errors: result.errors,
                    warnings: result.warnings,
                  };
                }}
                style={{
                  fontSize: '12px',
                }}
              />
            ) : undefined
          }
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

      // Actual semantic set node - draggable
      // Always expandable (hasChildren=true) because it always has AddNode for semantic values
      const handleSetDragStart = (e: React.DragEvent) => {
        if (semanticSetEditing.isEditing(set.id)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'semantic-set',
          setId: set.id,
          label: set.name,
        }));
        e.dataTransfer.effectAllowed = 'copy';
        attachDragImage(e, '#fbbf24', 'M3 3h18v18H3z', set.name);
      };

      const handleEditSet = () => semanticSetEditing.handleEdit(set.id);
      const handleSaveSet = (newName: string) => semanticSetEditing.handleSave(set.id, newName, onUpdateSemanticSet);
      const handleCancelEditSet = () => semanticSetEditing.handleCancel();
      const handleDeleteSet = () => semanticSetEditing.handleDelete(set.id, set.name, onDeleteSemanticSet);
      const isEditingSet = semanticSetEditing.isEditing(set.id);

      return (
        <SlotTreeNode
          icon={<Box size={14} color="#fbbf24" />}
          label={set.name}
          isExpanded={isExpanded}
          hasChildren={true}
          onToggle={() => onToggleExpanded(node.id)}
          onSelect={() => onSelect(node.id)}
          isSelected={isSelected}
          level={node.level}
          theme={theme}
          draggable={!isEditingSet}
          onDragStart={handleSetDragStart}
          onEdit={handleEditSet}
          onDelete={handleDeleteSet}
          isEditing={isEditingSet}
          editingComponent={
            isEditingSet ? (
              <EditableText
                value={semanticSetEditing.editingValue}
                editing={isEditingSet}
                onSave={handleSaveSet}
                onCancel={handleCancelEditSet}
                placeholder="Semantic set name..."
                showActionButtons={true}
                expectedLanguage="it"
                showLanguageWarning={true}
                enableVoice={true}
                multiline={false}
                validation={(value) => {
                  const result = validateSemanticSetName(value, semanticSets, set.id);
                  return {
                    isValid: result.isValid,
                    errors: result.errors,
                    warnings: result.warnings,
                  };
                }}
                style={{
                  fontSize: '12px',
                }}
              />
            ) : undefined
          }
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

      // Actual semantic value node - draggable
      const handleValueDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'semantic-value',
          valueId: value.id,
          label: value.value,
        }));
        e.dataTransfer.effectAllowed = 'copy';
        attachDragImage(e, '#fb923c', 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', value.value);
      };

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
          draggable={true}
          onDragStart={handleValueDragStart}
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
                validation={(synonym) => {
                  // Get all synonyms from all semantic values in the set
                  const setId = node.parentId?.replace('set-', '') || '';
                  const set = semanticSets.find((s) => s.id === setId);
                  if (!set) {
                    return { isValid: false, errors: ['Semantic set not found'] };
                  }
                  // Collect all synonyms from all values in the set
                  const allSynonyms = set.values.flatMap((v) => v.synonyms);
                  return validateLinguisticValue(synonym, allSynonyms);
                }}
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
