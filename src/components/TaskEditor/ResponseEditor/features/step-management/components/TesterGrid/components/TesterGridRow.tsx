import React from 'react';
import TesterGridPhraseColumn from './TesterGridPhraseColumn';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import ExtractionResultCell from './ExtractionResultCell';
import NoteButton from '@responseEditor/CellNote/NoteButton';
import NoteEditor from '@responseEditor/CellNote/NoteEditor';
import NoteDisplay from '@responseEditor/CellNote/NoteDisplay';
import NoteSeparator from '@responseEditor/CellNote/NoteSeparator';
import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import type { ContractType, DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import { getContractMethodLabel, type ContractMethod } from '@responseEditor/ContractSelector/ContractSelector';
import { useNotesStore, getCellKeyFromPhrase } from '@responseEditor/features/step-management/stores/notesStore';

interface TesterGridRowProps {
  rowIndex: number;
  phrase: string;
  rowResult: RowResult;
  phraseColumnWidth: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  selectedRow: number | null;
  onSelectRow: (idx: number) => void;
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  enabledMethods: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
  showDeterministic: boolean;
  showNER: boolean;
  showEmbeddings: boolean;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  contract?: DataContract | null;
  // Cell editing
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // ✅ REMOVED: Notes props - now managed via Zustand store (stores/notesStore.ts)
  // Actions
  runRowTest?: (idx: number) => Promise<void>;
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  examplesListLength: number;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  baselineStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  globalMaxMs?: number; // ✅ Global maximum milliseconds across all rows and engines
  cancelTesting?: () => void; // ✅ Cancel function to abort running tests
}

/**
 * Row component for displaying a single test phrase and its results
 *
 * ✅ ENTERPRISE-READY: Memoized with granular comparison
 * Re-renders ONLY when rowResult changes, enabling per-cell updates
 */
function TesterGridRowComponent({
  rowIndex,
  phrase,
  rowResult,
  phraseColumnWidth,
  isResizing,
  onResizeStart,
  selectedRow,
  onSelectRow,
  kind,
  expectedKeysForKind,
  enabledMethods,
  showDeterministic,
  showNER,
  showEmbeddings,
  activeEditor,
  contract, // ✅ FIX: Contract per colonne dinamiche
  // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  // ✅ REMOVED: Notes props - now managed via Zustand store
  runRowTest,
  runAllRows,
  testing,
  examplesListLength,
  reportOpen,
  setReportOpen,
  baselineStats,
  lastStats,
  globalMaxMs,
  cancelTesting,
}: TesterGridRowProps) {
  // ✅ REMOVED: Notes are now managed via Zustand store

  const leading = rowResult.running ? (
    <span title="Analisi in corso" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />
  ) : null;

  // ✅ FIX: Use globalMaxMs for consistent scale across all rows
  // If globalMaxMs is not provided, fallback to row-local max (backward compatibility)
  const maxMs = globalMaxMs !== undefined
    ? globalMaxMs
    : Math.max(rowResult.regexMs || 0, rowResult.detMs || 0, rowResult.nerMs || 0, rowResult.llmMs || 0);

  return (
    <tr
      style={{
        borderTop: '1px solid #e5e7eb',
        cursor: 'pointer',
        background: selectedRow === rowIndex ? '#fff7ed' : '#fff'
      }}
      onClick={() => onSelectRow(rowIndex)}
    >
      <TesterGridPhraseColumn
        phrase={phrase}
        spans={rowResult.spans}
        width={phraseColumnWidth}
        isResizing={isResizing}
        onResizeStart={onResizeStart}
        leading={leading}
        rowBackground={selectedRow === rowIndex ? '#fff7ed' : '#fff'} // ✅ FIX: Passa il background della riga
      />
      <TesterGridActionsColumn
        rowIndex={rowIndex}
        runRowTest={runRowTest}
        runAllRows={rowIndex === 0 ? runAllRows : undefined}
        testing={testing}
        examplesListLength={examplesListLength}
        reportOpen={rowIndex === 1 ? reportOpen : undefined}
        setReportOpen={rowIndex === 1 ? setReportOpen : undefined}
        phraseColumnWidth={phraseColumnWidth}
        rowBackground={selectedRow === rowIndex ? '#fff7ed' : '#fff'} // ✅ FIX: Passa il background della riga
        cancelTesting={rowIndex === 0 ? cancelTesting : undefined} // ✅ Only show cancel on row 0 (Run All button)
      />
      {/* Render colonne dinamiche basate su contract.engines */}
      {(() => {
        const engines = contract?.engines || [];

        // ✅ Se non ci sono engines, non mostrare colonne (unificato: sempre logica dinamica)
        if (engines.length === 0) {
          return null;
        }

        // ✅ CRITICAL: Show ALL engines (enabled and disabled) to match header columns
        // Filtering for enabled engines happens during escalation execution, not in UI
        return engines
          .map((engineItem, engineIndex) => {
          const isLastEngine = engineIndex === engines.length - 1;
          const contractTypeLabel = getContractMethodLabel(engineItem.type as ContractMethod);
          const componentType = engineItem.type === 'rules' ? 'deterministic' : engineItem.type;
          const color = {
            regex: '#93c5fd',
            deterministic: '#e5e7eb',
            ner: '#fef3c7',
            llm: '#fed7aa',
            embeddings: '#e0e7ff',
            grammarflow: '#c084fc', // Purple color for grammarflow
          }[componentType] || '#93c5fd';

          const result = {
            regex: rowResult.regex,
            deterministic: rowResult.deterministic,
            ner: rowResult.ner,
            llm: rowResult.llm,
            embeddings: undefined,
            grammarflow: rowResult.grammarflow,
          }[componentType] || null;

          const processingTime = (() => {
            const msMap: Record<string, keyof RowResult> = {
              regex: 'regexMs',
              deterministic: 'detMs',
              ner: 'nerMs',
              llm: 'llmMs',
              grammarflow: 'grammarflowMs',
            };
            return (rowResult[msMap[componentType] || 'regexMs'] as number) || 0;
          })();

          const isRunning = {
            regex: rowResult.running,
            deterministic: rowResult.detRunning,
            ner: rowResult.nerRunning,
            llm: rowResult.llmRunning,
            embeddings: false,
            grammarflow: rowResult.grammarflowRunning || false,
          }[componentType] || false;

          const enabled = enabledMethods[componentType as keyof typeof enabledMethods] ?? false;

          // Special handling for grammarflow (similar to embeddings - placeholder until interpreter is ready)
          if (componentType === 'grammarflow') {
            return (
              <td
                key={engineItem.type}
                style={{
                  padding: 8,
                  color: '#374151',
                  overflow: 'visible',
                  background: color,
                  position: 'relative',
                  verticalAlign: 'top',
                  opacity: 1,
                  width: isLastEngine ? '100%' : undefined,
                  visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm', 'embeddings', 'grammarflow'].includes(activeEditor) && activeEditor !== componentType ? 'hidden' : 'visible'
                }}
                onMouseEnter={() => {
                  const { setHovered } = useNotesStore.getState();
                  setHovered(getCellKeyFromPhrase(phrase, 'grammarflow'));
                }}
                onMouseLeave={() => {
                  const { setHovered } = useNotesStore.getState();
                  setHovered(null);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Tipo contratto: {contractTypeLabel}
                    </div>
                    {/* Placeholder: GrammarFlow engine active (interpreter not yet implemented) */}
                    {result || '—'}
                  </div>
                  {(() => {
                    const { isHovered, hasNote, startEditing, stopEditing, editingNote } = useNotesStore();
                    const cellKey = getCellKeyFromPhrase(phrase, 'grammarflow');
                    return (isHovered(cellKey) || hasNote(cellKey)) && (
                      <NoteButton
                        hasNote={hasNote(cellKey)}
                        onClick={() => editingNote === cellKey ? stopEditing() : startEditing(cellKey)}
                      />
                    );
                  })()}
                </div>
                {(() => {
                  const { getNote, editingNote, addNote, deleteNote, stopEditing } = useNotesStore();
                  const cellKey = getCellKeyFromPhrase(phrase, 'grammarflow');
                  return (getNote(cellKey) || editingNote === cellKey) && (
                    <>
                      <NoteSeparator />
                      {editingNote === cellKey ? (
                        <NoteEditor
                          value={getNote(cellKey)}
                          onSave={(text) => { addNote(cellKey, text); stopEditing(); }}
                          onDelete={() => { deleteNote(cellKey); stopEditing(); }}
                          onCancel={stopEditing}
                        />
                      ) : (
                        <NoteDisplay text={getNote(cellKey)} />
                      )}
                    </>
                  );
                })()}
              </td>
            );
          }

          // Special handling for embeddings
          if (componentType === 'embeddings') {
            return (
              <td
                key={engineItem.type}
                style={{
                  padding: 8,
                  color: '#374151',
                  overflow: 'visible',
                  background: color,
                  position: 'relative',
                  verticalAlign: 'top',
                  opacity: 1,
                  width: isLastEngine ? '100%' : undefined,
                  visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm', 'embeddings', 'grammarflow'].includes(activeEditor) && activeEditor !== componentType ? 'hidden' : 'visible'
                }}
                onMouseEnter={() => {
                  const { setHovered } = useNotesStore.getState();
                  setHovered(getCellKeyFromPhrase(phrase, 'embeddings'));
                }}
                onMouseLeave={() => {
                  const { setHovered } = useNotesStore.getState();
                  setHovered(null);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Tipo contratto: {contractTypeLabel}
                    </div>
                    {/* TODO: Show classification results here in Fase 9 */}
                    {'—'}
                  </div>
                  {(() => {
                    const { isHovered, hasNote, startEditing, stopEditing, editingNote } = useNotesStore();
                    const cellKey = getCellKeyFromPhrase(phrase, 'embeddings');
                    return (isHovered(cellKey) || hasNote(cellKey)) && (
                      <NoteButton
                        hasNote={hasNote(cellKey)}
                        onClick={() => editingNote === cellKey ? stopEditing() : startEditing(cellKey)}
                      />
                    );
                  })()}
                </div>
                {(() => {
                  const { getNote, editingNote, addNote, deleteNote, stopEditing } = useNotesStore();
                  const cellKey = getCellKeyFromPhrase(phrase, 'embeddings');
                  return (getNote(cellKey) || editingNote === cellKey) && (
                    <>
                      <NoteSeparator />
                      {editingNote === cellKey ? (
                        <NoteEditor
                          value={getNote(cellKey)}
                          onSave={(text) => { addNote(cellKey, text); stopEditing(); }}
                          onDelete={() => { deleteNote(cellKey); stopEditing(); }}
                          onCancel={stopEditing}
                        />
                      ) : (
                        <NoteDisplay text={getNote(cellKey)} />
                      )}
                    </>
                  );
                })()}
              </td>
            );
          }

          // Regular extraction columns
          return (
            <td
              key={engineItem.type}
              style={{
                padding: 8,
                color: enabled ? '#374151' : '#9ca3af',
                overflow: 'visible',
                background: color,
                position: 'relative',
                verticalAlign: 'top',
                opacity: enabled ? 1 : 0.6,
                width: isLastEngine ? '100%' : undefined,
                  visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm', 'embeddings', 'grammarflow'].includes(activeEditor) && activeEditor !== componentType ? 'hidden' : 'visible'
              }}
              onMouseEnter={() => {
                const { setHovered } = useNotesStore.getState();
                setHovered(getCellKeyFromPhrase(phrase, componentType));
              }}
              onMouseLeave={() => {
                const { setHovered } = useNotesStore.getState();
                setHovered(null);
              }}
            >
              <ExtractionResultCell
                summary={result || undefined}
                processingTime={processingTime}
                maxMs={maxMs}
                rowIdx={rowIndex}
                phrase={phrase}
                col={componentType as any}
                contractTypeLabel={contractTypeLabel}
                kind={kind}
                expectedKeysForKind={expectedKeysForKind}
                enabled={enabled}
                isRunning={isRunning}
                // ✅ FASE 2 - REMOVED: cellOverrides, setCellOverrides - now managed via Zustand store
                editingCell={editingCell}
                editingText={editingText}
                setEditingCell={setEditingCell}
                setEditingText={setEditingText}
                // ✅ REMOVED: Notes props - now managed via Zustand store
              />
            </td>
          );
        });
      })()}
    </tr>
  );
}

/**
 * ✅ ENTERPRISE-READY: Memoized row component with granular comparison
 *
 * Re-renders ONLY when:
 * - rowResult changes (the actual test results)
 * - selectedRow changes (highlight state)
 * - Other critical props change
 *
 * This enables per-cell updates without re-rendering the entire row.
 */
const TesterGridRow = React.memo(TesterGridRowComponent, (prev, next) => {
  // ✅ CRITICAL: Check editingNote FIRST - this is essential for note editor to work
  if (prev.editingNote !== next.editingNote) {
    console.log('[NOTE] TesterGridRow MEMO - editingNote changed', {
      prevEditingNote: prev.editingNote,
      nextEditingNote: next.editingNote,
      rowIndex: prev.rowIndex,
      'will re-render': true
    });
    return false; // Re-render if editingNote changed
  }

  // ✅ Critical props that trigger re-render
  if (prev.rowResult !== next.rowResult) return false; // Re-render if results changed
  if (prev.selectedRow !== next.selectedRow) {
    // Only re-render if THIS row's selection state changed
    const prevSelected = prev.selectedRow === prev.rowIndex;
    const nextSelected = next.selectedRow === next.rowIndex;
    if (prevSelected !== nextSelected) return false;
  }
  if (prev.phrase !== next.phrase) return false; // Re-render if phrase changed
  if (prev.kind !== next.kind) return false; // Re-render if kind changed
  if (prev.enabledMethods !== next.enabledMethods) return false; // Re-render if methods changed
  if (prev.testing !== next.testing) return false; // Re-render if testing state changed
  if (prev.runAllRows !== next.runAllRows) return false; // Re-render if runAllRows ref changed

  // ✅ UI state props (compare by reference for performance)
  if (prev.activeEditor !== next.activeEditor) return false;
  if (prev.editingCell !== next.editingCell) {
    // Only re-render if THIS row is being edited
    const prevIsEditing = prev.editingCell?.row === prev.rowIndex;
    const nextIsEditing = next.editingCell?.row === next.rowIndex;
    if (prevIsEditing !== nextIsEditing) return false;
  }

  // ✅ All other props unchanged - skip re-render
  return true;
});

TesterGridRow.displayName = 'TesterGridRow';

export default TesterGridRow;
