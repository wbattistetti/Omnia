// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useState, useCallback } from 'react';
import { X, Undo2, Redo2 } from 'lucide-react';
import { useSlotEditor } from '../../hooks/SlotEditor/useSlotEditor';
import { useSlotTree } from '../../hooks/SlotEditor/useSlotTree';
import { SlotTree } from './SlotTree';

interface SlotEditorProps {
  editorMode?: 'text' | 'graph';
  onClose?: () => void;
}

/**
 * Main Slot Editor component
 * Single Responsibility: Orchestrates all slot editor functionality
 */
export function SlotEditor({ editorMode = 'text', onClose }: SlotEditorProps) {
  const {
    tree,
    slots,
    semanticSets,
    theme,
    createSlot,
    updateSlotName,
    removeSlot,
    createSemanticSet,
    updateSemanticSetName,
    removeSemanticSet,
    addSemanticValue,
    updateSemanticValue,
    removeSemanticValue,
    addLinguisticValue,
    updateLinguisticValue,
    removeLinguisticValue,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSlotEditor(editorMode);

  const {
    expanded,
    selected,
    toggleExpanded,
    setSelected,
    isExpanded,
  } = useSlotTree();

  // Track which AddNode should auto-edit (event-driven)
  const [autoEditKey, setAutoEditKey] = useState<string | null>(null);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleCreateSlot = (name: string) => {
    const result = createSlot(name);
    // Keep expanded, don't collapse
    if (result.success && result.slot && !isExpanded('slots-section')) {
      toggleExpanded('slots-section');
    }
  };

  const handleCreateSemanticSet = (name: string) => {
    const result = createSemanticSet(name);
    // Keep expanded, don't collapse
    if (result.success && result.set) {
      // Expand semantic sets section if not already expanded
      if (!isExpanded('semantic-sets-section')) {
        toggleExpanded('semantic-sets-section');
      }
      // Auto-expand the newly created semantic set so user can add values
      const newSetId = `set-${result.set.id}`;
      if (!isExpanded(newSetId)) {
        toggleExpanded(newSetId);
      }
    }
  };

  const handleCreateSemanticValue = useCallback((setId: string, value: string) => {
    const result = addSemanticValue(setId, value);
    // Keep expanded, don't collapse
    if (result.success) {
      if (!isExpanded(`set-${setId}`)) {
        toggleExpanded(`set-${setId}`);
      }
      // Wait for React to re-render and reorder alphabetically
      // Then trigger auto-edit after stabilization (clean algorithm)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now tree is reordered, activate AddNode
          setAutoEditKey(`semantic-value-${setId}`);
        });
      });
    }
  }, [addSemanticValue, isExpanded, toggleExpanded]);

  const handleCreateLinguisticValue = useCallback((setId: string, valueId: string, synonym: string) => {
    const result = addLinguisticValue(setId, valueId, synonym);
    // Keep expanded, don't collapse
    if (result.success) {
      if (!isExpanded(`value-${valueId}`)) {
        toggleExpanded(`value-${valueId}`);
      }
      // Wait for React to re-render and reorder alphabetically
      // Then trigger auto-edit after stabilization (clean algorithm)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now tree is reordered, activate AddNode
          setAutoEditKey(`linguistic-value-${valueId}`);
        });
      });
    }
  }, [addLinguisticValue, isExpanded, toggleExpanded]);

  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.background,
        borderLeft: `1px solid ${theme.border}`,
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: canUndo ? theme.text : theme.placeholder,
              opacity: canUndo ? 1 : 0.5,
            }}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: canRedo ? theme.text : theme.placeholder,
              opacity: canRedo ? 1 : 0.5,
            }}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: theme.text,
              }}
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        <SlotTree
          tree={tree}
          expanded={expanded}
          selected={selected}
          onToggleExpanded={toggleExpanded}
          onSelect={setSelected}
          onCreateSlot={handleCreateSlot}
          onUpdateSlot={(slotId, name) => {
            const result = updateSlotName(slotId, name);
            if (!result.success && result.error) {
              console.error('Failed to update slot:', result.error);
            }
          }}
          onDeleteSlot={(slotId) => {
            const result = removeSlot(slotId);
            if (!result.success && result.error) {
              console.error('Failed to delete slot:', result.error);
            }
          }}
          onCreateSemanticSet={handleCreateSemanticSet}
          onUpdateSemanticSet={(setId, name) => {
            const result = updateSemanticSetName(setId, name);
            if (!result.success && result.error) {
              console.error('Failed to update semantic set:', result.error);
            }
          }}
          onDeleteSemanticSet={(setId) => {
            const result = removeSemanticSet(setId);
            if (!result.success && result.error) {
              console.error('Failed to delete semantic set:', result.error);
            }
          }}
          onCreateSemanticValue={handleCreateSemanticValue}
          onUpdateSemanticValue={(setId, valueId, newValue) => {
            const result = updateSemanticValue(setId, valueId, newValue);
            if (!result.success && result.error) {
              console.error('Failed to update semantic value:', result.error);
            }
          }}
          onDeleteSemanticValue={(setId, valueId) => {
            const result = removeSemanticValue(setId, valueId);
            if (!result.success && result.error) {
              console.error('Failed to delete semantic value:', result.error);
            }
          }}
          onCreateLinguisticValue={handleCreateLinguisticValue}
          onUpdateLinguisticValue={(setId, valueId, oldSynonym, newSynonym) => {
            const result = updateLinguisticValue(setId, valueId, oldSynonym, newSynonym);
            if (!result.success && result.error) {
              console.error('Failed to update linguistic value:', result.error);
            }
          }}
          onDeleteLinguisticValue={(setId, valueId, synonym) => {
            const result = removeLinguisticValue(setId, valueId, synonym);
            if (!result.success && result.error) {
              console.error('Failed to delete linguistic value:', result.error);
            }
          }}
          slots={slots}
          semanticSets={semanticSets}
          theme={theme}
          autoEditKey={autoEditKey}
          onAutoEditComplete={() => setAutoEditKey(null)}
        />
      </div>
    </div>
  );
}
