import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { renderTimeBar } from '@responseEditor/features/step-management/components/TesterGrid/helpers/renderTimeBar';
import { parseSummaryToGroups } from '@responseEditor/features/step-management/components/TesterGrid/helpers/parseSummaryToGroups';
import GroupDetailsExpander from '@responseEditor/features/step-management/components/TesterGrid/components/GroupDetailsExpander';
import NoteButton from '@responseEditor/CellNote/NoteButton';
import NoteEditor from '@responseEditor/CellNote/NoteEditor';
import NoteDisplay from '@responseEditor/CellNote/NoteDisplay';
import NoteSeparator from '@responseEditor/CellNote/NoteSeparator';
import { useNotesStore, getCellKeyFromPhrase } from '@responseEditor/features/step-management/stores/notesStore';
import { useCellOverridesStore } from '@responseEditor/features/step-management/stores/cellOverridesStore';

interface ExtractionResultCellProps {
  summary: string | undefined;
  processingTime?: number;
  maxMs?: number;
  rowIdx: number; // ✅ Kept for backward compatibility, but phrase is preferred
  phrase: string; // ✅ NEW: Phrase text for stable key generation
  col: 'regex' | 'det' | 'ner' | 'llm';
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  enabled: boolean;
  isRunning?: boolean;
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  editingText: string;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // ✅ REMOVED: Notes props - now managed via Zustand store (stores/notesStore.ts)
}

/**
 * Cell component for displaying extraction results
 * Shows main value and expandable group details
 *
 * ✅ ENTERPRISE-READY: Memoized with granular comparison
 * Re-renders ONLY when summary, isRunning, or processingTime change
 * This enables per-cell updates without re-rendering the entire row
 */
function ExtractionResultCellComponent({
  summary,
  processingTime,
  maxMs,
  rowIdx,
  phrase, // ✅ NEW: Phrase text for stable key
  col,
  kind,
  expectedKeysForKind,
  enabled,
  isRunning,
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell,
  editingText,
  setEditingCell,
  setEditingText,
}: ExtractionResultCellProps) {
  // ✅ FASE 2 - OPTIMIZATION: Use Zustand store directly instead of props
  const cellOverridesStore = useCellOverridesStore();
  const [isExpanded, setIsExpanded] = React.useState(false);

  // ✅ Use Zustand store for notes - zero prop drilling!
  const editingNote = useNotesStore((s) => s.editingNote);
  const notes = useNotesStore((s) => s.notes);

  // ✅ Get functions from store state (functions that use get() need direct access)
  // ✅ Use new phrase|method-based functions from store
  const getNoteByPhraseAndMethod = useNotesStore.getState().getNoteByPhraseAndMethod;
  const hasNoteForPhraseAndMethod = useNotesStore.getState().hasNoteForPhraseAndMethod;
  const setNoteForPhraseAndMethod = useNotesStore.getState().setNoteForPhraseAndMethod;
  const deleteNoteForPhraseAndMethod = useNotesStore.getState().deleteNoteForPhraseAndMethod;
  const startEditing = useNotesStore.getState().startEditing;
  const stopEditing = useNotesStore.getState().stopEditing;

  // ✅ Use phrase-based key (stable, not index-based)
  const cellKey = getCellKeyFromPhrase(phrase, col);
  const isCurrentlyEditing = editingNote === cellKey;
  const currentNote = getNoteByPhraseAndMethod(phrase, col);
  const hasNote = hasNoteForPhraseAndMethod(phrase, col);

  // ✅ REMOVED: Debug logs - notes are now managed via Zustand store

  // ✅ Force re-render when editing state changes by using the values in render
  // This ensures the component updates when isEditing/getNote return different values
  const kv = parseSummaryToGroups(summary);
  const keys = expectedKeysForKind(kind);
  // ✅ FIX: hasGroups deve essere true se ci sono chiavi nel summary (anche solo 'value')
  // Il chevron deve apparire anche se c'è solo value= per mostrare i dettagli
  const hasGroups = Object.keys(kv).length > 0 && Object.keys(kv).some(k => kv[k] !== undefined && kv[k] !== '');

  // Extract full match value
  // If summary has "value=", extract it; otherwise use the full summary or first group value
  let fullValue = '—';
  if (summary && summary !== '—') {
    if (summary.includes('value=')) {
      // Extract value after "value="
      const valueMatch = summary.match(/value=([^,]+)/);
      if (valueMatch && valueMatch[1]) {
        fullValue = valueMatch[1].trim();
      } else {
        // ✅ Fallback: se c'è "value=" ma non matcha, prova a estrarre tutto dopo "value="
        const valueIndex = summary.indexOf('value=');
        if (valueIndex !== -1) {
          const afterValue = summary.substring(valueIndex + 6); // "value=" è 6 caratteri
          const commaIndex = afterValue.indexOf(',');
          fullValue = commaIndex !== -1 ? afterValue.substring(0, commaIndex).trim() : afterValue.trim();
        }
      }
    } else if (hasGroups) {
      // If we have groups but no "value=", reconstruct from groups or use summary
      // Try to get a meaningful value from the groups
      const firstGroupValue = Object.values(kv).find(v => v !== undefined && v !== '') as string | undefined;
      fullValue = firstGroupValue || summary.split(',')[0] || summary;
    } else {
      // No groups, use summary as-is
      fullValue = summary;
    }
  }


  const ms = (v?: number) => (typeof v === 'number' ? ` (${v} ms)` : '');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          {enabled ? (
            <>
              {isRunning && (
                <span
                  title={col === 'regex' ? 'Regex' : col === 'det' ? 'Deterministic' : col === 'ner' ? 'NER' : 'LLM'}
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    border: '2px solid #60a5fa',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    marginRight: 6,
                    animation: 'spin 0.8s linear infinite'
                  }}
                />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span>{fullValue}{ms(processingTime)}</span>
                {/* ✅ Icona nota a destra del valore */}
                {(() => {
                  const shouldShowNoteButton = enabled && summary && summary !== '—';
                  console.log('[NOTE] ExtractionResultCell NoteButton render check', {
                    rowIdx,
                    col,
                    enabled,
                    summary,
                    'summary !== "—"': summary !== '—',
                    shouldShowNoteButton
                  });
                  return shouldShowNoteButton ? (
                    <NoteButton
                    hasNote={hasNote}
                    onClick={() => {
                      if (isCurrentlyEditing) {
                        stopEditing();
                      } else {
                        startEditing(cellKey);
                      }
                    }}
                  />
                  ) : null;
                })()}
                {/* ✅ Icona occhio a destra della nota (sostituisce chevron) */}
                {hasGroups && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: '#64748b',
                      flexShrink: 0,
                    }}
                    title={isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli'}
                  >
                    {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
              {processingTime !== undefined && maxMs !== undefined && renderTimeBar(processingTime, maxMs)}
              {hasGroups && isExpanded && (
                <GroupDetailsExpander
                  summary={summary}
                  rowIdx={rowIdx}
                  col={col}
                  kind={kind}
                  expectedKeysForKind={expectedKeysForKind}
                  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
                  editingCell={editingCell}
                  editingText={editingText}
                  setEditingCell={setEditingCell}
                  setEditingText={setEditingText}
                />
              )}
            </>
          ) : '—'}
        </div>
      </div>
      {(() => {
        const hasNoteValue = currentNote;
        const shouldShowNoteSection = (hasNoteValue || isCurrentlyEditing) && enabled;
        if (!shouldShowNoteSection) {
          return null;
        }
        return (
          <>
            <NoteSeparator />
            {isCurrentlyEditing ? (
              <NoteEditor
                value={currentNote}
                onSave={(text) => {
                  setNoteForPhraseAndMethod(phrase, col, text);
                  stopEditing();
                }}
                onDelete={() => {
                  deleteNoteForPhraseAndMethod(phrase, col);
                  stopEditing();
                }}
                onCancel={stopEditing}
              />
            ) : (
              <NoteDisplay text={currentNote} />
            )}
          </>
        );
      })()}
    </>
  );
}

/**
 * ✅ ENTERPRISE-READY: Memoized cell component with granular comparison
 *
 * Re-renders ONLY when:
 * - summary changes (the actual result value)
 * - isRunning changes (loading state)
 * - processingTime changes (performance metric)
 * - note editing state changes (editingNoteKey prop)
 * - note content changes (getNote result)
 *
 * ✅ ROBUST: Uses editingNoteKey prop directly instead of function calls
 * This eliminates timing issues and ensures reliable re-renders when editing state changes
 */
const ExtractionResultCell = React.memo(ExtractionResultCellComponent, (prev, next) => {
  // ✅ REMOVED: Notes props comparison - notes are now managed via Zustand store
  // Components using notes will re-render automatically via Zustand subscriptions
  // We only need to compare props that are NOT managed by Zustand

  // ✅ Critical props that trigger re-render
  if (prev.summary !== next.summary) return false; // Re-render if summary changed
  if (prev.isRunning !== next.isRunning) return false; // Re-render if loading state changed
  if (prev.processingTime !== next.processingTime) return false; // Re-render if timing changed
  if (prev.enabled !== next.enabled) return false; // Re-render if enabled state changed

  // ✅ Editing-related props (compare by reference for performance)
  if (prev.editingCell !== next.editingCell) {
    // Only re-render if THIS cell is being edited
    const prevIsEditing = prev.editingCell?.row === prev.rowIdx && prev.editingCell?.col === prev.col;
    const nextIsEditing = next.editingCell?.row === next.rowIdx && next.editingCell?.col === next.col;
    if (prevIsEditing !== nextIsEditing) return false;
  }
  if (prev.editingText !== next.editingText) {
    // Only re-render if THIS cell is being edited
    const isEditing = prev.editingCell?.row === prev.rowIdx && prev.editingCell?.col === prev.col;
    if (isEditing) return false;
  }

  // ✅ All other props unchanged - skip re-render
  return true;
});

ExtractionResultCell.displayName = 'ExtractionResultCell';

export default ExtractionResultCell;
