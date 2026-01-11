import React from 'react';
import TesterGridPhraseColumn from './TesterGridPhraseColumn';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import ExtractionResultCell from './ExtractionResultCell';
import NoteButton from '../../CellNote/NoteButton';
import NoteEditor from '../../CellNote/NoteEditor';
import NoteDisplay from '../../CellNote/NoteDisplay';
import NoteSeparator from '../../CellNote/NoteSeparator';
import { RowResult } from '../../hooks/useExtractionTesting';

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
  // Cell editing
  cellOverrides: Record<string, string>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // Notes
  hasNote: (row: number, col: string) => boolean;
  getNote: (row: number, col: string) => string | undefined;
  addNote: (row: number, col: string, text: string) => void;
  deleteNote: (row: number, col: string) => void;
  isEditing: (row: number, col: string) => boolean;
  startEditing: (row: number, col: string) => void;
  stopEditing: () => void;
  isHovered: (row: number, col: string) => boolean;
  setHovered: (row: number | null, col: string | null) => void;
  // Actions
  runRowTest?: (idx: number) => Promise<void>;
  runAllRows?: () => Promise<void>;
  testing?: boolean;
  examplesListLength: number;
  reportOpen?: boolean;
  setReportOpen?: (open: boolean) => void;
  baselineStats?: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats?: { matched: number; falseAccept: number; totalGt: number } | null;
}

/**
 * Row component for displaying a single test phrase and its results
 */
export default function TesterGridRow({
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
  cellOverrides,
  setCellOverrides,
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  hasNote,
  getNote,
  addNote,
  deleteNote,
  isEditing,
  startEditing,
  stopEditing,
  isHovered,
  setHovered,
  runRowTest,
  runAllRows,
  testing,
  examplesListLength,
  reportOpen,
  setReportOpen,
  baselineStats,
  lastStats,
}: TesterGridRowProps) {
  const leading = rowResult.running ? (
    <span title="Analisi in corso" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />
  ) : null;
  const maxMs = Math.max(rowResult.detMs || 0, rowResult.nerMs || 0, rowResult.llmMs || 0);

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
      />
      <TesterGridActionsColumn
        rowIndex={rowIndex}
        runRowTest={runRowTest}
        runAllRows={rowIndex === 0 ? runAllRows : undefined}
        testing={testing}
        examplesListLength={examplesListLength}
        reportOpen={rowIndex === 1 ? reportOpen : undefined}
        setReportOpen={rowIndex === 1 ? setReportOpen : undefined}
      />
      {/* Regex column */}
      <td
        style={{
          padding: 8,
          color: enabledMethods.regex ? '#374151' : '#9ca3af',
          overflow: 'visible',
          background: '#93c5fd',
          position: 'relative',
          verticalAlign: 'top',
          opacity: enabledMethods.regex ? 1 : 0.6,
          visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) ? 'hidden' : 'visible'
        }}
        onMouseEnter={() => setHovered(rowIndex, 'regex')}
        onMouseLeave={() => setHovered(null, null)}
      >
        <ExtractionResultCell
          summary={rowResult.regex}
          processingTime={rowResult.regexMs}
          maxMs={maxMs}
          rowIdx={rowIndex}
          col="regex"
          kind={kind}
          expectedKeysForKind={expectedKeysForKind}
          enabled={enabledMethods.regex}
          cellOverrides={cellOverrides}
          editingCell={editingCell}
          editingText={editingText}
          setEditingCell={setEditingCell}
          setEditingText={setEditingText}
          setCellOverrides={setCellOverrides}
          hasNote={hasNote}
          getNote={getNote}
          isEditing={isEditing}
          startEditing={startEditing}
          stopEditing={stopEditing}
          addNote={addNote}
          deleteNote={deleteNote}
          isHovered={isHovered}
          setHovered={setHovered}
        />
      </td>
      {/* Deterministic column */}
      {showDeterministic && (
        <td
          style={{
            padding: 8,
            color: enabledMethods.deterministic ? '#374151' : '#9ca3af',
            overflow: 'visible',
            background: '#e5e7eb',
            position: 'relative',
            verticalAlign: 'top',
            opacity: enabledMethods.deterministic ? 1 : 0.6,
            visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) ? 'hidden' : 'visible'
          }}
          onMouseEnter={() => setHovered(rowIndex, 'deterministic')}
          onMouseLeave={() => setHovered(null, null)}
        >
          <ExtractionResultCell
            summary={rowResult.deterministic}
            processingTime={rowResult.detMs}
            maxMs={maxMs}
            rowIdx={rowIndex}
            col="det"
            kind={kind}
            expectedKeysForKind={expectedKeysForKind}
            enabled={enabledMethods.deterministic}
            isRunning={rowResult.detRunning}
            cellOverrides={cellOverrides}
            editingCell={editingCell}
            editingText={editingText}
            setEditingCell={setEditingCell}
            setEditingText={setEditingText}
            setCellOverrides={setCellOverrides}
            hasNote={hasNote}
            getNote={getNote}
            isEditing={isEditing}
            startEditing={startEditing}
            stopEditing={stopEditing}
            addNote={(row, col, text) => addNote(row, col, text)}
            deleteNote={(row, col) => deleteNote(row, col)}
            isHovered={isHovered}
            setHovered={setHovered}
          />
        </td>
      )}
      {/* NER column */}
      {showNER && (
        <td
          style={{
            padding: 8,
            color: enabledMethods.ner ? '#374151' : '#9ca3af',
            overflow: 'visible',
            background: '#fef3c7',
            position: 'relative',
            verticalAlign: 'top',
            opacity: enabledMethods.ner ? 1 : 0.6,
            visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) ? 'hidden' : 'visible'
          }}
          onMouseEnter={() => setHovered(rowIndex, 'ner')}
          onMouseLeave={() => setHovered(null, null)}
        >
          <ExtractionResultCell
            summary={rowResult.ner}
            processingTime={rowResult.nerMs}
            maxMs={maxMs}
            rowIdx={rowIndex}
            col="ner"
            kind={kind}
            expectedKeysForKind={expectedKeysForKind}
            enabled={enabledMethods.ner}
            isRunning={rowResult.nerRunning}
            cellOverrides={cellOverrides}
            editingCell={editingCell}
            editingText={editingText}
            setEditingCell={setEditingCell}
            setEditingText={setEditingText}
            setCellOverrides={setCellOverrides}
            hasNote={hasNote}
            getNote={getNote}
            isEditing={isEditing}
            startEditing={startEditing}
            stopEditing={stopEditing}
            addNote={(row, col, text) => addNote(row, col, text)}
            deleteNote={(row, col) => deleteNote(row, col)}
            isHovered={isHovered}
            setHovered={setHovered}
          />
        </td>
      )}
      {/* Embeddings column */}
      {showEmbeddings && (
        <td
          style={{
            padding: 8,
            color: '#374151',
            overflow: 'visible',
            background: '#e0e7ff',
            position: 'relative',
            verticalAlign: 'top',
            opacity: 1
          }}
          onMouseEnter={() => setHovered(rowIndex, 'embeddings')}
          onMouseLeave={() => setHovered(null, null)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
              {/* TODO: Show classification results here in Fase 9 */}
              {'—'}
            </div>
            {(isHovered(rowIndex, 'embeddings') || hasNote(rowIndex, 'embeddings')) && (
              <NoteButton
                hasNote={hasNote(rowIndex, 'embeddings')}
                onClick={() => isEditing(rowIndex, 'embeddings') ? stopEditing() : startEditing(rowIndex, 'embeddings')}
              />
            )}
          </div>
          {(getNote(rowIndex, 'embeddings') || isEditing(rowIndex, 'embeddings')) && (
            <>
              <NoteSeparator />
              {isEditing(rowIndex, 'embeddings') ? (
                <NoteEditor
                  value={getNote(rowIndex, 'embeddings')}
                  onSave={(text) => { addNote(rowIndex, 'embeddings', text); stopEditing(); }}
                  onDelete={() => { deleteNote(rowIndex, 'embeddings'); stopEditing(); }}
                  onCancel={stopEditing}
                />
              ) : (
                <NoteDisplay text={getNote(rowIndex, 'embeddings')} />
              )}
            </>
          )}
        </td>
      )}
      {/* LLM column */}
      <td
        style={{
          padding: 8,
          color: enabledMethods.llm ? '#374151' : '#9ca3af',
          overflow: 'visible',
          background: '#fed7aa',
          position: 'relative',
          verticalAlign: 'top',
          opacity: enabledMethods.llm ? 1 : 0.6,
          visibility: activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) ? 'hidden' : 'visible'
        }}
        onMouseEnter={() => setHovered(rowIndex, 'llm')}
        onMouseLeave={() => setHovered(null, null)}
      >
        <ExtractionResultCell
          summary={rowResult.llm}
          processingTime={rowResult.llmMs}
          maxMs={maxMs}
          rowIdx={rowIndex}
          col="llm"
          kind={kind}
          expectedKeysForKind={expectedKeysForKind}
          enabled={enabledMethods.llm}
          isRunning={rowResult.llmRunning}
          cellOverrides={cellOverrides}
          editingCell={editingCell}
          editingText={editingText}
          setEditingCell={setEditingCell}
          setEditingText={setEditingText}
          setCellOverrides={setCellOverrides}
          hasNote={hasNote}
          getNote={getNote}
          isEditing={isEditing}
          startEditing={startEditing}
          stopEditing={stopEditing}
          addNote={(row, col, text) => addNote(row, col, text)}
          deleteNote={(row, col) => deleteNote(row, col)}
          isHovered={isHovered}
          setHovered={setHovered}
        />
      </td>
    </tr>
  );
}
