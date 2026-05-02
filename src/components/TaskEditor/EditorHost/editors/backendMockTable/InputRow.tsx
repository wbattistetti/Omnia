/**
 * Celle SEND per una riga della mock table (parametri di input editabili).
 * Editor HTML5 in base al tipo OpenAPI (date / time / number / …).
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import type { BackendMockTableRow } from '../../../../../domain/backendTest/backendTestRowTypes';
import type { OpenApiInputUiKind } from '../../../../../services/openApiBackendCallSpec';

export type InputRowProps = {
  row: BackendMockTableRow;
  visibleInputColumns: Array<{ name: string; isActive: boolean }>;
  editingCell: { rowId: string; param: string } | null;
  cellDraft: string;
  onCellDraftChange: (v: string) => void;
  onStartEdit: (rowId: string, param: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  getCellValue: (rowId: string, param: string) => string;
  /** Chiave = `internalName` colonna input. */
  inputUiKindByInternalName?: Record<string, OpenApiInputUiKind>;
  /** Chiave = `internalName` — descrizione + «. Clicca per editare.» */
  inputTooltipByInternalName?: Record<string, string>;
};

function htmlInputTypeForKind(kind: OpenApiInputUiKind | undefined): string {
  if (!kind || kind === 'text') return 'text';
  return kind;
}

export function InputRow({
  row,
  visibleInputColumns,
  editingCell,
  cellDraft,
  onCellDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  getCellValue,
  inputUiKindByInternalName = {},
  inputTooltipByInternalName = {},
}: InputRowProps) {
  return (
    <>
      {visibleInputColumns.map((col) => {
        const isParked = !col.isActive;
        const isEditingCell = editingCell?.rowId === row.id && editingCell?.param === col.name;
        const cellValueStr = getCellValue(row.id, col.name);
        const kind = inputUiKindByInternalName[col.name];
        const htmlType = htmlInputTypeForKind(kind);
        const cellTitle = inputTooltipByInternalName[col.name] || 'Clicca per editare.';
        const parkedTitle = 'Colonna parked (sola lettura).';
        return (
          <td
            key={`input_${col.name}_${row.id}`}
            className={`px-2 py-2 border-l border-slate-700 ${isParked ? 'bg-slate-800/30' : ''}`}
          >
            {isParked ? (
              <div className="w-full px-1.5 py-1 text-xs text-slate-500 italic truncate" title={parkedTitle}>
                {cellValueStr || 'empty'}
              </div>
            ) : isEditingCell ? (
              <div className="flex items-center gap-1">
                <input
                  type={htmlType}
                  value={cellDraft}
                  onChange={(e) => onCellDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSaveEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      onCancelEdit();
                    }
                  }}
                  className="min-w-0 flex-1 px-1.5 py-1 bg-slate-800 border border-cyan-500 rounded text-xs text-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="p-0.5 hover:bg-green-600 rounded text-green-400"
                  title="Save"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="p-0.5 hover:bg-red-600 rounded text-red-400"
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onStartEdit(row.id, col.name)}
                className="flex min-h-[2rem] w-full items-center px-1.5 py-1 text-left text-xs text-slate-300 hover:bg-slate-700 rounded truncate"
                title={cellTitle}
              >
                {cellValueStr || <span className="text-slate-500 italic">empty</span>}
              </button>
            )}
          </td>
        );
      })}
    </>
  );
}
