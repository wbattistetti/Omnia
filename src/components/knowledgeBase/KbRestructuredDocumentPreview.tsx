/**
 * Anteprima tabellare del documento KB riformattato (solo dati, pretty per umani).
 */

import React from 'react';
import { parseMarkdownPipeTable } from '@domain/knowledgeBase/parseKbTabularText';
import { extractRestructuredDataForRuntime } from '@domain/knowledgeBase/kbDocumentRestructureSplit';
import { KbTabularPreview } from './KbTabularPreview';
import {
  KbRestructuredTableWithNotes,
  type KbRestructuredTableChangePayload,
} from './KbRestructuredTableWithNotes';

export type { KbRestructuredTableChangePayload };

export type KbRestructuredDocumentPreviewProps = {
  markdown: string;
  className?: string;
  rowNotes?: Readonly<Record<string, string>>;
  onRowNoteChange?: (rowKey: string, note: string) => void;
  onRowNoteBlur?: (rowKey: string, note: string) => void;
  interactiveNotesDisabled?: boolean;
  editable?: boolean;
  columnInstructions?: Readonly<Record<string, string>>;
  onGridChange?: (payload: KbRestructuredTableChangePayload) => void;
  onColumnInstructionsChange?: (instructions: Record<string, string>) => void;
};

export function KbRestructuredDocumentPreview({
  markdown,
  className = '',
  rowNotes,
  onRowNoteChange,
  onRowNoteBlur,
  interactiveNotesDisabled = false,
  editable = false,
  columnInstructions,
  onGridChange,
  onColumnInstructionsChange,
}: KbRestructuredDocumentPreviewProps): React.ReactElement {
  const dataMd = React.useMemo(() => extractRestructuredDataForRuntime(markdown), [markdown]);

  const parsed = React.useMemo(() => {
    if (!dataMd.trim()) return null;
    return parseMarkdownPipeTable(dataMd, { maxRows: 500 });
  }, [dataMd]);

  if (!dataMd.trim()) {
    return (
      <p className={`px-2 py-4 text-xs text-slate-500 ${className}`}>
        Nessun dato normalizzato da mostrare.
      </p>
    );
  }

  if (parsed?.grid) {
    if (onRowNoteChange || onRowNoteBlur || onGridChange) {
      return (
        <KbRestructuredTableWithNotes
          grid={parsed.grid}
          preamble={parsed.preamble}
          rowNotes={rowNotes ?? {}}
          disabled={interactiveNotesDisabled}
          editable={editable}
          columnInstructions={columnInstructions ?? {}}
          className={className}
          onRowNoteChange={onRowNoteChange ?? (() => undefined)}
          onRowNoteBlur={onRowNoteBlur}
          onGridChange={onGridChange}
          onColumnInstructionsChange={onColumnInstructionsChange}
        />
      );
    }
    return (
      <KbTabularPreview grid={parsed.grid} preamble={parsed.preamble} className={className} />
    );
  }

  return (
    <pre
      className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-2 py-2 font-mono text-xs leading-snug text-slate-200 ${className}`}
    >
      {dataMd}
    </pre>
  );
}
