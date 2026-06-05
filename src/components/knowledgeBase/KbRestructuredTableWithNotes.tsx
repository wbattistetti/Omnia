/**
 * Tabella riformattata editabile: colonne, celle (replace per colonna), note riga.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { KbTabularGrid } from '@domain/knowledgeBase/parseKbTabularText';
import {
  addGridColumn,
  cloneKbTabularGrid,
  commitGridCellEdit,
  createPendingColumnHeader,
  deleteGridColumn,
  insertGridColumnAfter,
  isPendingColumnHeader,
  normalizeGridCellValue,
  remapColumnInstructions,
  removeColumnInstruction,
  renameGridColumn,
  reorderGridColumn,
  setSingleGridCellValue,
  toKbTabularGrid,
} from '@domain/knowledgeBase/kbRestructuredGridEdit';
import { restructureRowKey } from '@domain/knowledgeBase/kbDocumentRestructureWorkflow';
import {
  kbTabularColumnWidthCh,
  kbTabularEditableFieldWidthCh,
} from '@domain/knowledgeBase/kbTabularColumnSizing';
import {
  KB_RESTRUCTURE_ADD_COLUMN_TOOLBAR,
  KB_RESTRUCTURE_BULK_REPLACE_TOAST,
} from '@domain/knowledgeBase/kbDocumentRestructureGuide';
import { KbAutoGrowTextarea } from './KbAutoGrowTextarea';

export type KbRestructuredTableChangePayload = {
  grid: KbTabularGrid;
  preamble: readonly string[];
  rowNotes: Record<string, string>;
  columnInstructions?: Record<string, string>;
  toast?: string;
};

export type KbRestructuredTableWithNotesProps = {
  grid: KbTabularGrid;
  preamble?: readonly string[];
  rowNotes: Readonly<Record<string, string>>;
  disabled?: boolean;
  editable?: boolean;
  columnInstructions?: Readonly<Record<string, string>>;
  className?: string;
  onRowNoteChange: (rowKey: string, note: string) => void;
  onRowNoteBlur?: (rowKey: string, note: string) => void;
  onGridChange?: (payload: KbRestructuredTableChangePayload) => void;
  onColumnInstructionsChange?: (instructions: Record<string, string>) => void;
};

function displayCell(value: string): string {
  const v = normalizeGridCellValue(value);
  return v || '—';
}

type KbRestructuredColumnHeaderProps = {
  colIndex: number;
  header: string;
  colWidthCh: number;
  draft: string | undefined;
  isEditing: boolean;
  isPendingColumn: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  columnInstruction?: string;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelPendingEdit: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onAddColumnRight: () => void;
  onDelete: () => void;
};

function headerToolbarButtonProps(onClick: () => void): {
  type: 'button';
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
} {
  return {
    type: 'button',
    onMouseDown: (e) => e.preventDefault(),
    onClick: (e) => {
      e.stopPropagation();
      onClick();
    },
  };
}

function displayColumnHeaderLabel(header: string): string {
  if (isPendingColumnHeader(header)) return '';
  return header;
}

function KbRestructuredColumnHeader({
  colIndex,
  header,
  colWidthCh,
  draft,
  isEditing,
  isPendingColumn,
  canMoveLeft,
  canMoveRight,
  canDelete,
  columnInstruction,
  onDraftChange,
  onStartEdit,
  onCommitEdit,
  onCancelPendingEdit,
  onMoveLeft,
  onMoveRight,
  onAddColumnRight,
  onDelete,
}: KbRestructuredColumnHeaderProps): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing) inputRef.current?.focus({ preventScroll: true });
  }, [isEditing]);

  const shown = draft !== undefined ? draft : displayColumnHeaderLabel(header);
  const labelText = displayColumnHeaderLabel(header) || '—';

  return (
    <div className="group relative flex min-w-0 flex-col gap-0.5">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="rounded border border-amber-600/50 bg-slate-950/70 px-1 py-0.5 text-[11px] font-semibold text-amber-100 focus:border-amber-500/70 focus:outline-none"
          style={{
            width: `${kbTabularEditableFieldWidthCh(colWidthCh, shown || 'nome')}ch`,
            maxWidth: '42ch',
          }}
          value={shown}
          placeholder="nome_colonna"
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.preventDefault();
              if (isPendingColumn && !shown.trim()) {
                onCancelPendingEdit();
                return;
              }
              onDraftChange(displayColumnHeaderLabel(header));
              onCommitEdit();
            }
          }}
          aria-label={`Nome colonna ${colIndex + 1}`}
        />
      ) : (
        <>
          <span
            className="block min-w-0 truncate px-1 py-0.5 pr-0.5 text-[11px] font-semibold text-amber-100"
            title={labelText === '—' ? '' : labelText}
          >
            {isPendingColumn ? (
              <span className="text-slate-500">nome_colonna</span>
            ) : (
              labelText
            )}
          </span>
          <div
            className={
              'pointer-events-none absolute right-0 top-0 z-30 flex items-center gap-0.5 rounded border border-slate-600/80 ' +
              'bg-slate-900/95 px-0.5 py-0.5 opacity-0 shadow-lg backdrop-blur-sm transition-opacity ' +
              'group-hover/col:pointer-events-auto group-hover/col:opacity-100'
            }
          >
            <button
              {...headerToolbarButtonProps(onStartEdit)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-amber-200"
              title="Rinomina colonna"
            >
              <Pencil className="h-3 w-3" aria-hidden />
            </button>
            <button
              {...headerToolbarButtonProps(onMoveLeft)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
              disabled={!canMoveLeft}
              title="Sposta colonna a sinistra"
            >
              <ChevronLeft className="h-3 w-3" aria-hidden />
            </button>
            <button
              {...headerToolbarButtonProps(onMoveRight)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
              disabled={!canMoveRight}
              title="Sposta colonna a destra"
            >
              <ChevronRight className="h-3 w-3" aria-hidden />
            </button>
            <button
              {...headerToolbarButtonProps(onAddColumnRight)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-emerald-300"
              title={KB_RESTRUCTURE_ADD_COLUMN_TOOLBAR}
            >
              <Plus className="h-3 w-3" aria-hidden />
            </button>
            <button
              {...headerToolbarButtonProps(onDelete)}
              className="rounded p-0.5 text-slate-400 hover:bg-rose-950 hover:text-rose-300 disabled:opacity-30"
              disabled={!canDelete}
              title="Elimina colonna"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </>
      )}
      {columnInstruction?.trim() ? (
        <p
          className="text-[9px] font-normal leading-tight text-violet-300/80"
          title={columnInstruction}
        >
          ↳ {columnInstruction.trim().slice(0, 60)}
          {columnInstruction.trim().length > 60 ? '…' : ''}
        </p>
      ) : null}
    </div>
  );
}

export function KbRestructuredTableWithNotes({
  grid,
  preamble = [],
  rowNotes,
  disabled = false,
  editable = false,
  columnInstructions = {},
  className = '',
  onRowNoteChange,
  onRowNoteBlur,
  onGridChange,
  onColumnInstructionsChange,
}: KbRestructuredTableWithNotesProps): React.ReactElement {
  const [hoveredRow, setHoveredRow] = React.useState<number | null>(null);
  const [focusedNoteRow, setFocusedNoteRow] = React.useState<number | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [headerDrafts, setHeaderDrafts] = React.useState<Record<number, string>>({});
  const [cellDrafts, setCellDrafts] = React.useState<Record<string, string>>({});
  /** Valore grezzo della cella al momento del clic (identità per Ctrl+Invio in colonna). */
  const [cellEditOrigins, setCellEditOrigins] = React.useState<Record<string, string>>({});
  const [editingCellKey, setEditingCellKey] = React.useState<string | null>(null);
  const [editingHeaderCol, setEditingHeaderCol] = React.useState<number | null>(null);
  const cellKeyboardCommitRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const canEditGrid = editable && !disabled && Boolean(onGridChange);

  const rowKeys = React.useMemo(
    () => grid.rows.map((row, i) => restructureRowKey(grid.headers, row, i)),
    [grid.headers, grid.rows]
  );

  const colWidths = React.useMemo(
    () =>
      grid.headers.map((h, i) => {
        const headerForSizing = isPendingColumnHeader(h) ? 'nome_colonna' : h;
        const contentW = kbTabularColumnWidthCh(
          headerForSizing,
          grid.rows.map((r) => r[i] ?? '')
        );
        return canEditGrid ? Math.max(contentW, Math.min(14, headerForSizing.length + 4)) : contentW;
      }),
    [canEditGrid, grid.headers, grid.rows]
  );

  const noteColWidthCh = 14;

  const emitGridChange = React.useCallback(
    (
      nextGrid: KbTabularGrid,
      patch?: { rowNotes?: Record<string, string>; columnInstructions?: Record<string, string>; toast?: string }
    ) => {
      if (!onGridChange) return;
      onGridChange({
        grid: nextGrid,
        preamble,
        rowNotes: patch?.rowNotes ?? { ...rowNotes },
        ...(patch?.columnInstructions !== undefined
          ? { columnInstructions: patch.columnInstructions }
          : {}),
        ...(patch?.toast ? { toast: patch.toast } : {}),
      });
      if (patch?.toast) setToast(patch.toast);
    },
    [onGridChange, preamble, rowNotes]
  );

  const applyGridMutation = React.useCallback(
    (
      mutate: (mutable: ReturnType<typeof cloneKbTabularGrid>) => ReturnType<typeof cloneKbTabularGrid>,
      patch?: { columnInstructions?: Record<string, string>; toast?: string }
    ) => {
      const mutable = cloneKbTabularGrid(grid);
      const next = mutate(mutable);
      emitGridChange(toKbTabularGrid(next), patch);
    },
    [emitGridChange, grid]
  );

  const onMoveColumn = React.useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= grid.headers.length) return;
      applyGridMutation((g) => reorderGridColumn(g, index, target));
    },
    [applyGridMutation, grid.headers.length]
  );

  const onDeleteColumn = React.useCallback(
    (index: number) => {
      const header = grid.headers[index] ?? '';
      try {
        applyGridMutation((g) => deleteGridColumn(g, index), {
          columnInstructions: removeColumnInstruction(columnInstructions, header),
        });
        onColumnInstructionsChange?.(removeColumnInstruction(columnInstructions, header));
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
      }
    },
    [applyGridMutation, columnInstructions, grid.headers, onColumnInstructionsChange]
  );

  const removePendingColumn = React.useCallback(
    (colIndex: number) => {
      const oldHeader = grid.headers[colIndex] ?? '';
      if (!isPendingColumnHeader(oldHeader)) return;
      try {
        applyGridMutation((g) => deleteGridColumn(g, colIndex), {
          columnInstructions: removeColumnInstruction(columnInstructions, oldHeader),
        });
        onColumnInstructionsChange?.(removeColumnInstruction(columnInstructions, oldHeader));
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
      }
    },
    [applyGridMutation, columnInstructions, grid.headers, onColumnInstructionsChange]
  );

  const commitHeaderRename = React.useCallback(
    (colIndex: number, draft: string) => {
      const oldHeader = grid.headers[colIndex] ?? '';
      const nextHeader = draft.trim();
      setHeaderDrafts((prev) => {
        const copy = { ...prev };
        delete copy[colIndex];
        return copy;
      });
      if (!nextHeader) {
        if (isPendingColumnHeader(oldHeader)) removePendingColumn(colIndex);
        return;
      }
      if (!isPendingColumnHeader(oldHeader) && nextHeader === oldHeader.trim()) return;
      if (
        grid.headers.some(
          (h, i) => i !== colIndex && h.trim().toLowerCase() === nextHeader.toLowerCase()
        )
      ) {
        setToast(`Colonna «${nextHeader}» già presente`);
        setHeaderDrafts((prev) => ({ ...prev, [colIndex]: nextHeader }));
        setEditingHeaderCol(colIndex);
        return;
      }
      try {
        const mutable = cloneKbTabularGrid(grid);
        const updated = renameGridColumn(mutable, colIndex, nextHeader);
        const nextInstructions = remapColumnInstructions(columnInstructions, oldHeader, nextHeader);
        emitGridChange(toKbTabularGrid(updated), { columnInstructions: nextInstructions });
        onColumnInstructionsChange?.(nextInstructions);
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
      }
    },
    [columnInstructions, emitGridChange, grid, onColumnInstructionsChange, removePendingColumn]
  );

  const startHeaderEdit = React.useCallback((colIndex: number) => {
    const h = grid.headers[colIndex] ?? '';
    const initial = isPendingColumnHeader(h) ? '' : h;
    setHeaderDrafts((prev) => (prev[colIndex] !== undefined ? prev : { ...prev, [colIndex]: initial }));
    setEditingHeaderCol(colIndex);
  }, [grid.headers]);

  const finishHeaderEdit = React.useCallback(
    (colIndex: number) => {
      const oldHeader = grid.headers[colIndex] ?? '';
      const draft = headerDrafts[colIndex] ?? (isPendingColumnHeader(oldHeader) ? '' : oldHeader);
      commitHeaderRename(colIndex, draft);
      setEditingHeaderCol((cur) => (cur === colIndex ? null : cur));
    },
    [commitHeaderRename, grid.headers, headerDrafts]
  );

  const cancelPendingHeaderEdit = React.useCallback(
    (colIndex: number) => {
      setHeaderDrafts((prev) => {
        const copy = { ...prev };
        delete copy[colIndex];
        return copy;
      });
      setEditingHeaderCol((cur) => (cur === colIndex ? null : cur));
      removePendingColumn(colIndex);
    },
    [removePendingColumn]
  );

  const addColumnAfter = React.useCallback(
    (afterIndex: number) => {
      try {
        const placeholder = createPendingColumnHeader(grid.headers);
        const mutable = cloneKbTabularGrid(grid);
        const updated = insertGridColumnAfter(mutable, afterIndex, placeholder, '');
        emitGridChange(toKbTabularGrid(updated));
        const newIndex = afterIndex + 1;
        setHeaderDrafts({ [newIndex]: '' });
        setEditingHeaderCol(newIndex);
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
      }
    },
    [emitGridChange, grid]
  );

  const beginCellEdit = React.useCallback((rowIndex: number, colIndex: number, rawValue: string) => {
    const key = `${rowIndex}-${colIndex}`;
    setEditingCellKey(key);
    setCellEditOrigins((prev) => ({ ...prev, [key]: rawValue }));
    setCellDrafts((prev) => ({ ...prev, [key]: rawValue }));
  }, []);

  const clearCellEditSession = React.useCallback((key: string) => {
    setCellDrafts((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setCellEditOrigins((prev) => {
      if (!(key in prev)) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const commitCellEdit = React.useCallback(
    (
      rowIndex: number,
      colIndex: number,
      originRaw: string,
      draft: string,
      propagateColumn: boolean
    ) => {
      const key = `${rowIndex}-${colIndex}`;
      clearCellEditSession(key);
      const previous = normalizeGridCellValue(originRaw);
      const next = normalizeGridCellValue(draft);
      if (previous === next) return;

      const mutable = cloneKbTabularGrid(grid);
      if (propagateColumn) {
        const { grid: updated, replacedCount } = commitGridCellEdit(
          mutable,
          rowIndex,
          colIndex,
          originRaw,
          draft
        );
        const toastMsg =
          replacedCount > 1
            ? KB_RESTRUCTURE_BULK_REPLACE_TOAST.replace('{n}', String(replacedCount))
            : undefined;
        emitGridChange(toKbTabularGrid(updated), { toast: toastMsg });
        return;
      }

      const updated = setSingleGridCellValue(mutable, rowIndex, colIndex, draft);
      emitGridChange(toKbTabularGrid(updated));
    },
    [clearCellEditSession, emitGridChange, grid]
  );

  return (
    <div
      className={
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-slate-800 bg-slate-950/40 ' +
        className
      }
    >
      {toast ? (
        <p className="shrink-0 border-b border-emerald-900/50 bg-emerald-950/40 px-2 py-1 text-[11px] text-emerald-200">
          {toast}
        </p>
      ) : null}

      {preamble.length > 0 ? (
        <div className="shrink-0 space-y-0.5 border-b border-slate-800/80 px-2 py-1.5">
          {preamble.map((line, i) => (
            <p key={`pre-${i}`} className="text-slate-500">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain">
        <table className="w-max border-collapse text-left text-xs text-slate-200">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={`col-${i}`} style={{ width: `${w}ch` }} />
            ))}
            <col style={{ width: `${noteColWidthCh}ch` }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgb(30_41_59)]">
            <tr>
              {grid.headers.map((h, i) => (
                <th
                  key={`h-${i}-${h}`}
                  className="group/col relative overflow-visible border-b border-slate-700 px-1 py-1 align-top font-semibold text-amber-200/90"
                  style={{ width: `${colWidths[i]}ch`, maxWidth: `${colWidths[i]! + 2}ch` }}
                >
                  {canEditGrid ? (
                    <KbRestructuredColumnHeader
                      colIndex={i}
                      header={h}
                      colWidthCh={colWidths[i]!}
                      draft={headerDrafts[i]}
                      isEditing={editingHeaderCol === i}
                      isPendingColumn={isPendingColumnHeader(h)}
                      canMoveLeft={i > 0}
                      canMoveRight={i < grid.headers.length - 1}
                      canDelete={grid.headers.length > 1}
                      columnInstruction={
                        isPendingColumnHeader(h) ? undefined : columnInstructions[h]
                      }
                      onDraftChange={(value) =>
                        setHeaderDrafts((prev) => ({ ...prev, [i]: value }))
                      }
                      onStartEdit={() => startHeaderEdit(i)}
                      onCommitEdit={() => finishHeaderEdit(i)}
                      onCancelPendingEdit={() => cancelPendingHeaderEdit(i)}
                      onMoveLeft={() => onMoveColumn(i, -1)}
                      onMoveRight={() => onMoveColumn(i, 1)}
                      onAddColumnRight={() => addColumnAfter(i)}
                      onDelete={() => onDeleteColumn(i)}
                    />
                  ) : (
                    <span className="whitespace-nowrap px-1 py-0.5" title={h}>
                      {isPendingColumnHeader(h) ? '—' : h || '—'}
                    </span>
                  )}
                </th>
              ))}
              <th className="whitespace-nowrap border-b border-slate-700 px-2 py-1.5 font-semibold text-violet-200/90">
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, ri) => {
              const rowKey = rowKeys[ri]!;
              const note = rowNotes[rowKey] ?? '';
              const showNoteEditor =
                hoveredRow === ri || focusedNoteRow === ri || Boolean(note.trim());

              return (
                <tr
                  key={`r-${ri}-${rowKey}`}
                  className="odd:bg-slate-950/50 even:bg-slate-900/30"
                  onMouseEnter={() => setHoveredRow(ri)}
                  onMouseLeave={() => setHoveredRow((cur) => (cur === ri ? null : cur))}
                >
                  {row.map((cell, ci) => {
                    const cellKey = `${ri}-${ci}`;
                    const draft = cellDrafts[cellKey];
                    const editOrigin = cellEditOrigins[cellKey];
                    const shown = draft !== undefined ? draft : cell;

                    return (
                      <td
                        key={`c-${ri}-${ci}`}
                        className="border-b border-slate-800/80 px-1 py-0.5 text-slate-300"
                        style={{ width: `${colWidths[ci]}ch`, maxWidth: '42ch' }}
                      >
                        {canEditGrid && editingCellKey === cellKey ? (
                          <input
                            type="text"
                            autoFocus
                            className="rounded border border-violet-600/50 bg-slate-950/80 px-1 py-0.5 text-[11px] text-slate-200 focus:border-violet-600/50 focus:outline-none"
                            style={{
                              width: `${kbTabularEditableFieldWidthCh(colWidths[ci]!, shown)}ch`,
                              maxWidth: '42ch',
                            }}
                            value={shown}
                            title={`${displayCell(cell)} — Invio: solo cella · Ctrl+Invio: colonna`}
                            onChange={(e) =>
                              setCellDrafts((prev) => ({ ...prev, [cellKey]: e.target.value }))
                            }
                            onBlur={() => {
                              if (cellKeyboardCommitRef.current === cellKey) {
                                cellKeyboardCommitRef.current = null;
                                return;
                              }
                              const origin = editOrigin ?? cell;
                              commitCellEdit(
                                ri,
                                ci,
                                origin,
                                cellDrafts[cellKey] ?? origin,
                                false
                              );
                              setEditingCellKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                clearCellEditSession(cellKey);
                                cellKeyboardCommitRef.current = cellKey;
                                setEditingCellKey(null);
                                return;
                              }
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              const origin = editOrigin ?? cell;
                              cellKeyboardCommitRef.current = cellKey;
                              commitCellEdit(
                                ri,
                                ci,
                                origin,
                                e.currentTarget.value,
                                e.ctrlKey || e.metaKey
                              );
                              setEditingCellKey(null);
                            }}
                            aria-label={`Cella riga ${ri + 1} colonna ${grid.headers[ci]}`}
                          />
                        ) : canEditGrid ? (
                          <button
                            type="button"
                            className="block max-w-[42ch] truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-left text-[11px] text-slate-300 hover:border-slate-700/60"
                            title={`${displayCell(cell)} — clic per modificare · Invio: solo cella · Ctrl+Invio: colonna`}
                            onClick={() => beginCellEdit(ri, ci, cell)}
                          >
                            {displayCell(cell)}
                          </button>
                        ) : (
                          <span
                            className="block max-w-[42ch] truncate px-1 py-0.5"
                            title={cell}
                          >
                            {displayCell(cell)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className="border-b border-slate-800/80 px-1 py-0.5 align-top"
                    style={{ width: `${noteColWidthCh}ch` }}
                  >
                    {showNoteEditor ? (
                      <KbAutoGrowTextarea
                        className="rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-1 text-[11px] leading-snug text-slate-200 placeholder:text-slate-600 focus:border-violet-600/70 focus:outline-none"
                        style={{ width: `${noteColWidthCh}ch`, maxWidth: '32ch' }}
                        placeholder="+ Nota designer…"
                        value={note}
                        disabled={disabled}
                        onFocus={() => setFocusedNoteRow(ri)}
                        onBlur={(e) => {
                          setFocusedNoteRow((cur) => (cur === ri ? null : cur));
                          onRowNoteBlur?.(rowKey, e.target.value);
                        }}
                        onChange={(e) => onRowNoteChange(rowKey, e.target.value)}
                        aria-label={`Nota riga ${ri + 1}`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-violet-300"
                        disabled={disabled}
                        onClick={() => setFocusedNoteRow(ri)}
                      >
                        + Nota
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
