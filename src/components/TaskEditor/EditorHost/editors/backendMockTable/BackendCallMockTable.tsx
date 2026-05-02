/**
 * Mock table evoluta per Backend Call: test per riga (MOCK/REAL), preview output, note, audit ultima risposta.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Braces, Plus, Trash2 } from 'lucide-react';
import {
  BackendExecutionMode,
  backendTestNoteKey,
  type BackendMockTableRow,
} from '../../../../../domain/backendTest/backendTestRowTypes';
import { isBackendMockRowInputsFilledForColumns } from '../../../../../domain/backendTest/backendMockRowCompletion';
import type { MappingEntry } from '../../../../FlowMappingPanel/mappingTypes';
import type { BackendOutputDef } from '../../../../../utils/backendCall/mapJsonResponseToWireOutputs';
import { useBackendTestRun } from '../../../../../hooks/useBackendTestRun';
import { logBackendCallTest } from '../../../../../debug/backendCallTestDebug';
import type { OpenApiInputUiKind } from '../../../../../services/openApiBackendCallSpec';
import { InputRow } from './InputRow';
import { OutputCell } from './OutputCell';
import type { MockOutputValueFormat } from './formatMockOutputValue';

type ColumnDef = { name: string; type: 'input' | 'output'; isActive: boolean };

export type BackendCallMockTableProps = {
  inputs: Array<{ internalName: string; variable?: string; fieldDescription?: string; apiParam?: string }>;
  outputs: Array<{ internalName: string; variable?: string; apiField?: string; fieldDescription?: string }>;
  rows: BackendMockTableRow[];
  columns?: ColumnDef[];
  /** Aggiornamento funzionale righe mock (allineato a useBackendTestRun). */
  onMockTableRecipe: (recipe: (prev: BackendMockTableRow[]) => BackendMockTableRow[]) => void;
  onColumnsChange?: (columns: ColumnDef[]) => void;
  mappingSend: MappingEntry[];
  endpoint: { url: string; method: string; headers?: Record<string, string> };
  defaultExecutionMode: BackendExecutionMode;
  /** Etichette variabile per colonna (display). */
  variableLabelByColumn: (internalName: string, zone: 'input' | 'output') => string | undefined;
  /** Tooltip «descrizione. Clicca per editare.» per colonna input (internalName). */
  inputTooltipByInternalName?: Record<string, string>;
  /** Tooltip valore mock output (internalName). */
  outputValueTooltipByInternalName?: Record<string, string>;
  /** Tipi UI per colonna input (internalName), da OpenAPI dopo Read API. */
  inputUiKindByInternalName?: Record<string, OpenApiInputUiKind>;
  /** Evidenzia righe con input incompleti (dopo tentativo Test API da toolbar). */
  highlightIncompleteRows?: boolean;
  /** Incrementato dal parent per avviare «Test API» su tutte le righe senza ref imperativo. */
  bulkTestNonce?: number;
  onBulkTestStart?: () => void;
  onBulkTestEnd?: () => void;
};

export function BackendCallMockTable({
  inputs,
  outputs,
  rows,
  columns,
  onMockTableRecipe,
  onColumnsChange,
  mappingSend,
  endpoint,
  defaultExecutionMode,
  variableLabelByColumn,
  inputTooltipByInternalName,
  outputValueTooltipByInternalName,
  inputUiKindByInternalName,
  highlightIncompleteRows,
  bulkTestNonce,
  onBulkTestStart,
  onBulkTestEnd,
}: BackendCallMockTableProps) {
    const [editingCell, setEditingCell] = useState<{ rowId: string; type: 'input' | 'output'; param: string } | null>(
      null
    );
    const [cellValue, setCellValue] = useState('');
    const [showParkedColumns, setShowParkedColumns] = useState(false);
    /** Tutte le celle output: JSON compatto (JS) vs indentato (Pretty). */
    const [outputValueFormat, setOutputValueFormat] = useState<MockOutputValueFormat>('js');

    const allColumns = useMemo(() => {
      if (!columns?.length) {
        const ic = inputs.map((i) => ({ name: i.internalName, type: 'input' as const, isActive: true }));
        const oc = outputs.map((o) => ({ name: o.internalName, type: 'output' as const, isActive: true }));
        return [...ic, ...oc];
      }
      return columns;
    }, [columns, inputs, outputs]);

    const visibleColumns = useMemo(
      () => (showParkedColumns ? allColumns : allColumns.filter((c) => c.isActive)),
      [allColumns, showParkedColumns]
    );
    const visibleInputColumns = visibleColumns.filter((c) => c.type === 'input');
    const visibleOutputColumns = visibleColumns.filter((c) => c.type === 'output');

    const activeMockInputInternalNames = useMemo(
      () => visibleInputColumns.filter((c) => c.isActive).map((c) => c.name),
      [visibleInputColumns]
    );

    const outputDefs: BackendOutputDef[] = useMemo(
      () =>
        (outputs || [])
          .filter((o) => o.internalName?.trim())
          .map((o) => ({ internalName: o.internalName.trim(), apiField: o.apiField?.trim() })),
      [outputs]
    );

    const getRows = useCallback(() => rows, [rows]);

    const { errorByRowId, runRow } = useBackendTestRun({
      getRows,
      onRowsUpdate: onMockTableRecipe,
      defaultExecutionMode,
      endpointUrl: endpoint.url.trim(),
      endpointMethod: endpoint.method,
      endpointHeaders: endpoint.headers,
      sendEntries: mappingSend,
      outputDefs,
    });

    /** Test bulk: solo righe con tutti gli input attivi compilati (allineato a `testApiReadiness` nel parent). */
    const runBulkTestOnCompleteRows = useCallback(async () => {
      const currentRows = getRows();
      const names = activeMockInputInternalNames;
      if (names.length === 0) {
        logBackendCallTest('runBulkTestOnCompleteRows: skip (nessun nome colonna input attivo)');
        return;
      }
      const ids = currentRows
        .filter((r) => isBackendMockRowInputsFilledForColumns(r, names))
        .map((r) => r.id);
      logBackendCallTest('runBulkTestOnCompleteRows: righe da eseguire', {
        rowIds: ids,
        activeInputColumns: names,
        totalRows: currentRows.length,
      });
      if (ids.length === 0) {
        logBackendCallTest('runBulkTestOnCompleteRows: nessuna riga completa, runRow non chiamato');
        return;
      }
      await Promise.all(ids.map((id) => runRow(id, { forceHttp: true })));
      logBackendCallTest('runBulkTestOnCompleteRows: Promise.all completato', { rowIds: ids });
    }, [getRows, activeMockInputInternalNames, runRow]);

    const lastHandledBulkNonce = useRef(0);
    useEffect(() => {
      if (bulkTestNonce == null || bulkTestNonce <= 0) return;
      if (bulkTestNonce === lastHandledBulkNonce.current) return;
      lastHandledBulkNonce.current = bulkTestNonce;
      logBackendCallTest('MockTable: effetto bulkTestNonce', { bulkTestNonce });
      void (async () => {
        onBulkTestStart?.();
        try {
          await runBulkTestOnCompleteRows();
        } finally {
          onBulkTestEnd?.();
        }
      })();
    }, [bulkTestNonce, runBulkTestOnCompleteRows, onBulkTestStart, onBulkTestEnd]);

    const cleanParkedColumns = useCallback(() => {
      if (!columns?.length || !onColumnsChange) return;
      const parked = columns.filter((c) => !c.isActive);
      if (!parked.length) return;
      const parkedNames = new Set(parked.map((c) => c.name));
      onColumnsChange(columns.filter((c) => c.isActive));
      onMockTableRecipe((prev) =>
        prev.map((row) => {
          const ni = { ...row.inputs };
          const no = { ...row.outputs };
          for (const k of parkedNames) {
            delete ni[k];
            delete no[k];
          }
          return { ...row, inputs: ni, outputs: no };
        })
      );
    }, [columns, onColumnsChange, onMockTableRecipe]);

    const addRow = () => {
      const newRow: BackendMockTableRow = {
        id: `row_${Date.now()}`,
        inputs: {},
        outputs: {},
        testRun: { executionMode: defaultExecutionMode, notes: {} },
      };
      onMockTableRecipe((prev) => [...prev, newRow]);
    };

    const deleteRow = (rowId: string) => {
      onMockTableRecipe((prev) => prev.filter((r) => r.id !== rowId));
    };

    const startEditing = (rowId: string, type: 'input' | 'output', param: string) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      const v = type === 'input' ? row.inputs[param] : row.outputs[param];
      setCellValue(v !== undefined && v !== null ? String(v) : '');
      setEditingCell({ rowId, type, param });
    };

    const saveCellEdit = () => {
      if (!editingCell) return;
      onMockTableRecipe((prev) => {
        const idx = prev.findIndex((r) => r.id === editingCell.rowId);
        const isLast = idx === prev.length - 1;
        const updated = prev.map((row) => {
          if (row.id !== editingCell.rowId) return row;
          const next = { ...row };
          if (editingCell.type === 'input') {
            next.inputs = { ...next.inputs, [editingCell.param]: cellValue };
          } else {
            next.outputs = { ...next.outputs, [editingCell.param]: cellValue };
          }
          return next;
        });
        if (isLast) {
          return [
            ...updated,
            {
              id: `row_${Date.now()}`,
              inputs: {},
              outputs: {},
              testRun: { executionMode: defaultExecutionMode, notes: {} },
            },
          ];
        }
        return updated;
      });
      setEditingCell(null);
      setCellValue('');
    };

    const cancelCellEdit = () => {
      setEditingCell(null);
      setCellValue('');
    };

    const getCellValue = useCallback((rowId: string, type: 'input' | 'output', param: string): string => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return '';
      const v = type === 'input' ? row.inputs[param] : row.outputs[param];
      return v !== undefined && v !== null ? String(v) : '';
    }, [rows]);

    const saveNote = (rowId: string, key: string, text: string) => {
      onMockTableRecipe((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const notes = { ...(r.testRun?.notes ?? {}), [key]: text };
          return {
            ...r,
            testRun: {
              executionMode: r.testRun?.executionMode ?? defaultExecutionMode,
              ...r.testRun,
              notes,
            },
          };
        })
      );
    };

    const saveOutputMock = (rowId: string, col: string, next: unknown) => {
      onMockTableRecipe((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, outputs: { ...r.outputs, [col]: next } } : r))
      );
    };

    useEffect(() => {
      if (rows.length === 0) {
        onMockTableRecipe(() => [
          {
            id: `row_${Date.now()}`,
            inputs: {},
            outputs: {},
            testRun: { executionMode: defaultExecutionMode, notes: {} },
          },
        ]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- solo mount / tabella vuota
    }, []);

    const parkedColumnsCount = allColumns.filter((c) => !c.isActive).length;

    return (
      <div className="flex h-full flex-col">
        {columns && columns.length > 0 && parkedColumnsCount > 0 ? (
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 p-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showParkedColumns}
                onChange={(e) => setShowParkedColumns(e.target.checked)}
                className="h-3 w-3"
              />
              <span>Show parked columns ({parkedColumnsCount})</span>
            </label>
            {showParkedColumns ? (
              <button
                type="button"
                onClick={cleanParkedColumns}
                className="rounded bg-red-600 px-2 py-1 text-[10px] text-white hover:bg-red-700"
              >
                Clean parked columns
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="border-collapse" style={{ tableLayout: 'auto', width: 'auto' }}>
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="sticky left-0 z-10 min-w-[40px] bg-slate-800 px-1 py-2 text-left text-xs font-semibold text-slate-400">
                    #
                  </th>
                  {visibleInputColumns.map((col) => {
                    const isParked = !col.isActive;
                    const variable = variableLabelByColumn(col.name, 'input');
                    return (
                      <th
                        key={`in_${col.name}`}
                        className={`whitespace-nowrap border-l border-t-2 border-b-2 border-slate-700 px-2 py-2 text-left text-xs font-semibold ${
                          isParked ? 'bg-slate-800/50 text-slate-500' : 'border-cyan-500 bg-cyan-500/20 text-cyan-500'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{col.name}</span>
                          {variable ? (
                            <span className={`mt-0.5 text-[10px] font-normal ${isParked ? 'text-slate-500' : 'text-cyan-400/70'}`}>
                              {variable}
                            </span>
                          ) : null}
                          {isParked ? <span className="mt-0.5 text-[9px] italic text-slate-500">(parked)</span> : null}
                        </div>
                      </th>
                    );
                  })}
                  {visibleOutputColumns.map((col) => {
                    const isParked = !col.isActive;
                    const variable = variableLabelByColumn(col.name, 'output');
                    return (
                      <th
                        key={`out_${col.name}`}
                        className={`whitespace-nowrap border-l border-t-2 border-b-2 border-slate-700 px-2 py-2 text-left text-xs font-semibold ${
                          isParked ? 'bg-slate-800/50 text-slate-500' : 'border-green-500 bg-green-500/20 text-green-500'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{col.name}</span>
                          {variable ? (
                            <span className={`mt-0.5 text-[10px] font-normal ${isParked ? 'text-slate-500' : 'text-green-400/70'}`}>
                              {variable}
                            </span>
                          ) : null}
                          {isParked ? <span className="mt-0.5 text-[9px] italic text-slate-500">(parked)</span> : null}
                        </div>
                      </th>
                    );
                  })}
                  <th className="min-w-[88px] border-l border-slate-700 bg-slate-800 px-1 py-2 text-center text-xs font-semibold text-slate-400">
                    <div className="flex flex-col items-center gap-1">
                      <span>Actions</span>
                      <div
                        className="flex items-center justify-center gap-0.5 rounded border border-slate-600/80 bg-slate-900/80 p-0.5"
                        role="group"
                        aria-label="Formato visualizzazione output (tutte le colonne)"
                      >
                        <button
                          type="button"
                          aria-pressed={outputValueFormat === 'js'}
                          title="JSON compatto (una riga)"
                          onClick={() => setOutputValueFormat('js')}
                          className={`rounded p-0.5 ${
                            outputValueFormat === 'js'
                              ? 'bg-slate-600 text-green-300 shadow-sm'
                              : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <Braces size={14} strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-pressed={outputValueFormat === 'pretty'}
                          title="JSON indentato (pretty-print)"
                          onClick={() => setOutputValueFormat('pretty')}
                          className={`rounded p-0.5 ${
                            outputValueFormat === 'pretty'
                              ? 'bg-slate-600 text-green-300 shadow-sm'
                              : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <AlignLeft size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const rowInputsComplete =
                    activeMockInputInternalNames.length > 0 &&
                    isBackendMockRowInputsFilledForColumns(row, activeMockInputInternalNames);
                  const showRowIncomplete =
                    Boolean(highlightIncompleteRows) &&
                    activeMockInputInternalNames.length > 0 &&
                    !rowInputsComplete;
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-700 hover:bg-slate-800/50 ${
                      showRowIncomplete ? 'ring-2 ring-inset ring-red-600/90' : ''
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-slate-900 px-1 py-2 align-top text-center text-xs text-slate-400">
                      <div>{rowIndex + 1}</div>
                      {row.testRun?.lastTestedAt ? (
                        <div
                          className="mt-0.5 text-[8px] leading-tight text-slate-600"
                          title={`Ultimo test: ${row.testRun.lastTestedAt}`}
                        >
                          {new Date(row.testRun.lastTestedAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      ) : null}
                      {errorByRowId[row.id] ? (
                        <div
                          className="mt-1 max-w-[72px] break-words text-left text-[9px] text-red-400"
                          title={errorByRowId[row.id]}
                        >
                          {errorByRowId[row.id]}
                        </div>
                      ) : null}
                    </td>
                    <InputRow
                      row={row}
                      visibleInputColumns={visibleInputColumns}
                      editingCell={
                        editingCell?.type === 'input'
                          ? { rowId: editingCell.rowId, param: editingCell.param }
                          : null
                      }
                      cellDraft={cellValue}
                      onCellDraftChange={setCellValue}
                      onStartEdit={(rowId, param) => startEditing(rowId, 'input', param)}
                      onSaveEdit={saveCellEdit}
                      onCancelEdit={cancelCellEdit}
                      getCellValue={(rowId, param) => getCellValue(rowId, 'input', param)}
                      inputTooltipByInternalName={inputTooltipByInternalName}
                      inputUiKindByInternalName={inputUiKindByInternalName}
                    />
                    {visibleOutputColumns.map((col) => {
                      const isParked = !col.isActive;
                      const v = row.outputs[col.name];
                      if (isParked) {
                        const s = v !== undefined && v !== null ? String(v) : '';
                        return (
                          <td key={`op_${col.name}_${row.id}`} className="border-l border-slate-700 bg-slate-800/30 px-1 py-1">
                            <div className="text-[10px] italic text-slate-500">{s || 'empty'}</div>
                          </td>
                        );
                      }
                      const nk = backendTestNoteKey('output', col.name);
                      return (
                        <td key={`op_${col.name}_${row.id}`} className="border-l border-slate-700 align-top">
                          <OutputCell
                            columnName={col.name}
                            value={v}
                            rawJson={row.testRun?.lastResponse?.rawJson}
                            noteKey={nk}
                            noteText={row.testRun?.notes?.[nk] ?? ''}
                            onNoteSave={(key, text) => saveNote(row.id, key, text)}
                            onSaveMockValue={(next) => saveOutputMock(row.id, col.name, next)}
                            valueTooltip={outputValueTooltipByInternalName?.[col.name]}
                            valueFormat={outputValueFormat}
                          />
                        </td>
                      );
                    })}
                    <td className="border-l border-slate-700 px-1 py-1 text-center align-top">
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="rounded p-1 text-red-400 hover:bg-red-600"
                        title="Delete row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              Add Row
            </button>
          </div>
        </div>
      </div>
    );
}
