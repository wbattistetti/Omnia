import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { renderTimeBar } from '../helpers/renderTimeBar';
import { parseSummaryToGroups } from '../helpers/parseSummaryToGroups';
import GroupDetailsExpander from './GroupDetailsExpander';
import NoteButton from '../../CellNote/NoteButton';
import NoteEditor from '../../CellNote/NoteEditor';
import NoteDisplay from '../../CellNote/NoteDisplay';
import NoteSeparator from '../../CellNote/NoteSeparator';

interface ExtractionResultCellProps {
  summary: string | undefined;
  processingTime?: number;
  maxMs?: number;
  rowIdx: number;
  col: 'regex' | 'det' | 'ner' | 'llm';
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  enabled: boolean;
  isRunning?: boolean;
  cellOverrides: Record<string, string>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  editingText: string;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Notes
  hasNote: (row: number, col: string) => boolean;
  getNote: (row: number, col: string) => string | undefined;
  isEditing: (row: number, col: string) => boolean;
  startEditing: (row: number, col: string) => void;
  stopEditing: () => void;
  addNote: (row: number, col: string, text: string) => void;
  deleteNote: (row: number, col: string) => void;
  isHovered: (row: number, col: string) => boolean;
  setHovered: (row: number | null, col: string | null) => void;
}

/**
 * Cell component for displaying extraction results
 * Shows main value and expandable group details
 */
export default function ExtractionResultCell({
  summary,
  processingTime,
  maxMs,
  rowIdx,
  col,
  kind,
  expectedKeysForKind,
  enabled,
  isRunning,
  cellOverrides,
  editingCell,
  editingText,
  setEditingCell,
  setEditingText,
  setCellOverrides,
  hasNote,
  getNote,
  isEditing,
  startEditing,
  stopEditing,
  addNote,
  deleteNote,
  isHovered,
  setHovered,
}: ExtractionResultCellProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const kv = parseSummaryToGroups(summary);
  const keys = expectedKeysForKind(kind);
  const hasGroups = keys.length > 0 && Object.keys(kv).some(k => kv[k] !== undefined && kv[k] !== '');

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
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                  cellOverrides={cellOverrides}
                  editingCell={editingCell}
                  editingText={editingText}
                  setEditingCell={setEditingCell}
                  setEditingText={setEditingText}
                  setCellOverrides={setCellOverrides}
                />
              )}
            </>
          ) : '—'}
        </div>
        {(isHovered(rowIdx, col) || hasNote(rowIdx, col)) && enabled && (
          <NoteButton
            hasNote={hasNote(rowIdx, col)}
            onClick={() => isEditing(rowIdx, col) ? stopEditing() : startEditing(rowIdx, col)}
          />
        )}
      </div>
      {(getNote(rowIdx, col) || isEditing(rowIdx, col)) && enabled && (
        <>
          <NoteSeparator />
          {isEditing(rowIdx, col) ? (
            <NoteEditor
              value={getNote(rowIdx, col)}
              onSave={(text) => { addNote(rowIdx, col, text); stopEditing(); }}
              onDelete={() => { deleteNote(rowIdx, col); stopEditing(); }}
              onCancel={stopEditing}
            />
          ) : (
            <NoteDisplay text={getNote(rowIdx, col)} />
          )}
        </>
      )}
    </>
  );
}
