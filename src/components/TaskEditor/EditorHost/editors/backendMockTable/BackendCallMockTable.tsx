/**
 * Mock table evoluta per Backend Call: test per riga (MOCK/REAL), preview output, note, audit ultima risposta.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AlignLeft, AlertTriangle, Braces, Plus, Trash2 } from 'lucide-react';
import {
  BackendExecutionMode,
  backendTestNoteKey,
  type BackendMockTableRow,
} from '../../../../../domain/backendTest/backendTestRowTypes';
import {
  isBackendMockRowIncompleteForBulkTest,
  isBackendMockTableReadyForBulkTest,
  listMissingDesignRequiredSendWireKeysForMockTest,
} from '../../../../../domain/backendTest/backendMockTestReadiness';
import type { MappingEntry } from '../../../../FlowMappingPanel/mappingTypes';
import type { BackendOutputDef } from '../../../../../utils/backendCall/mapJsonResponseToWireOutputs';
import { useBackendTestRun } from '../../../../../hooks/useBackendTestRun';
import { logBackendCallTest } from '../../../../../debug/backendCallTestDebug';
import { isEmptyBackendTestBodyJson } from '../../../../../domain/backendTest/describeBackendTestHttpPayload';
import { buildSendHttpRequest } from '../../../../../utils/backendCall/buildSendHttpRequest';
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
  portalConnectionId?: string;
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
  /** Come {@link bulkTestNonce} ma POST al gateway ConvAI (percorso ElevenLabs). */
  bulkGatewayTestNonce?: number;
  /** URL gateway (ngrok o localhost:3100) per test via gateway. */
  convaiGatewayPublicUrl?: string | null;
  /** Striscia endpoint (internalName): completa righe mock se le celle sono vuote. */
  endpointInvocationFallback?: Record<string, string>;
  onBulkTestStart?: () => void;
  onBulkTestEnd?: (result: 'ok' | 'skipped') => void;
  /** Righe obbligatorie mancanti o tabella non pronta (dopo commit cella in editing). */
  onBulkTestSkipped?: (message: string) => void;
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
  portalConnectionId,
  defaultExecutionMode,
  variableLabelByColumn,
  inputTooltipByInternalName,
  outputValueTooltipByInternalName,
  inputUiKindByInternalName,
  highlightIncompleteRows,
  bulkTestNonce,
  bulkGatewayTestNonce,
  convaiGatewayPublicUrl,
  endpointInvocationFallback,
  onBulkTestStart,
  onBulkTestEnd,
  onBulkTestSkipped,
}: BackendCallMockTableProps) {
    const [editingCell, setEditingCell] = useState<{ rowId: string; type: 'input' | 'output'; param: string } | null>(
      null
    );
    const [cellValue, setCellValue] = useState('');
    const [showParkedColumns, setShowParkedColumns] = useState(false);
    /** Tutte le celle output: JSON compatto (JS) vs indentato (Pretty). */
    const [outputValueFormat, setOutputValueFormat] = useState<MockOutputValueFormat>('js');
    /** Avviso dopo preflight bulk (body `{}` o celle in modifica non salvate). */
    const [bulkPayloadHint, setBulkPayloadHint] = useState<string | null>(null);

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

    /** Tutti i parametri SEND della tabella (non solo colonne visibili/attive): stesso criterio di BackendCallEditor. */
    const allMockInputInternalNames = useMemo(
      () => inputs.map((i) => i.internalName?.trim()).filter(Boolean) as string[],
      [inputs]
    );

    const outputDefs: BackendOutputDef[] = useMemo(
      () =>
        (outputs || [])
          .filter((o) => o.internalName?.trim())
          .map((o) => ({ internalName: o.internalName.trim(), apiField: o.apiField?.trim() })),
      [outputs]
    );

    const outputColumnNames = useMemo(
      () => outputs.map((o) => o.internalName?.trim()).filter(Boolean) as string[],
      [outputs]
    );

    /** Righe per HTTP: include bozza cella SEND ancora in modifica (prima del ✓). */
    const getRowsForTest = useCallback((): BackendMockTableRow[] => {
      if (!editingCell || editingCell.type !== 'input') return rows;
      return rows.map((row) => {
        if (row.id !== editingCell.rowId) return row;
        return {
          ...row,
          inputs: { ...(row.inputs ?? {}), [editingCell.param]: cellValue },
        };
      });
    }, [rows, editingCell, cellValue]);

    const applyCellEditRecipe = useCallback(
      (prev: BackendMockTableRow[]): BackendMockTableRow[] => {
        if (!editingCell) return prev;
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
      },
      [cellValue, defaultExecutionMode, editingCell]
    );

    const commitPendingCellEdit = useCallback(() => {
      if (!editingCell) return;
      flushSync(() => {
        onMockTableRecipe(applyCellEditRecipe);
        setEditingCell(null);
        setCellValue('');
      });
    }, [applyCellEditRecipe, editingCell, onMockTableRecipe]);

    const { errorByRowId, loadingByRowId, runRow } = useBackendTestRun({
      getRows: getRowsForTest,
      onRowsUpdate: onMockTableRecipe,
      defaultExecutionMode,
      endpointUrl: endpoint.url.trim(),
      endpointMethod: endpoint.method,
      endpointHeaders: endpoint.headers,
      portalConnectionId,
      sendEntries: mappingSend,
      outputDefs,
      endpointInvocationFallback,
      convaiGatewayPublicUrl,
    });

    /** Test bulk: righe senza obbligatori SEND mancanti (opzionali vuoti ok). */
    const runBulkTestOnFilledRows = useCallback(
      async (viaConvaiGateway: boolean) => {
      const currentRows = getRowsForTest();
      const names = allMockInputInternalNames;
      if (names.length === 0) {
        logBackendCallTest('runBulkTestOnFilledRows: skip (nessun param SEND)');
        return;
      }
      const fallback = endpointInvocationFallback ?? {};
      if (!isBackendMockTableReadyForBulkTest(mappingSend, currentRows, fallback)) {
        logBackendCallTest('runBulkTestOnFilledRows: skip (obbligatori SEND non soddisfatti)');
        return;
      }
      const ids = currentRows
        .filter((r) => !isBackendMockRowIncompleteForBulkTest(r, mappingSend, fallback))
        .map((r) => r.id);
      logBackendCallTest('runBulkTestOnFilledRows: righe da eseguire', {
        rowIds: ids,
        inputColumns: names,
        totalRows: currentRows.length,
      });
      if (ids.length === 0) {
        logBackendCallTest('runBulkTestOnFilledRows: nessuna riga con input, runRow non chiamato');
        return;
      }

      let anyEmptyBody = false;
      for (const id of ids) {
        const row = currentRows.find((r) => r.id === id);
        if (!row) continue;
        const mergedInputs = { ...fallback, ...(row.inputs ?? {}) };
        const built = buildSendHttpRequest({
          endpointUrl: endpoint.url.trim(),
          method: endpoint.method,
          endpointHeaders: endpoint.headers,
          portalConnectionId,
          sendEntries: mappingSend,
          rowInputs: mergedInputs,
        });
        if (isEmptyBackendTestBodyJson(built.bodyJson)) {
          anyEmptyBody = true;
          break;
        }
      }
      setBulkPayloadHint(
        anyEmptyBody
          ? 'Invio con body {} — nessun valore in tabella né letterale in Signature. Il backend userà i suoi default. Dettaglio in console [Omnia:BackendCallTest] (bodyJson, mergedInputs).'
          : null
      );

      onMockTableRecipe((prev) =>
        prev.map((row) => {
          if (!ids.includes(row.id)) return row;
          const clearedOutputs = { ...(row.outputs ?? {}) };
          for (const col of outputColumnNames) {
            delete clearedOutputs[col];
          }
          return {
            ...row,
            outputs: clearedOutputs,
            testRun: {
              executionMode: row.testRun?.executionMode ?? defaultExecutionMode,
              notes: row.testRun?.notes ?? {},
              lastResponse: undefined,
            },
          };
        })
      );

      try {
        await Promise.all(
          ids.map((id) => runRow(id, { forceHttp: true, viaConvaiGateway }))
        );
        logBackendCallTest('runBulkTestOnFilledRows: Promise.all completato', {
          rowIds: ids,
          viaConvaiGateway,
        });
      } finally {
        commitPendingCellEdit();
      }
    },
      [
      commitPendingCellEdit,
      getRowsForTest,
      allMockInputInternalNames,
      mappingSend,
      runRow,
      endpointInvocationFallback,
      onMockTableRecipe,
      outputColumnNames,
      defaultExecutionMode,
      endpoint.url,
      endpoint.method,
      endpoint.headers,
      portalConnectionId,
    ]
    );

    const runBulkPreflightOrSkip = useCallback(
      (onSkipped: (message: string) => void): boolean => {
        commitPendingCellEdit();
        const currentRows = getRowsForTest();
        const fallback = endpointInvocationFallback ?? {};
        if (
          allMockInputInternalNames.length === 0 ||
          !isBackendMockTableReadyForBulkTest(mappingSend, currentRows, fallback)
        ) {
          const missing =
            allMockInputInternalNames.length === 0
              ? []
              : listMissingDesignRequiredSendWireKeysForMockTest(
                  mappingSend,
                  currentRows,
                  fallback
                );
          onSkipped(
            allMockInputInternalNames.length === 0
              ? 'Nessun parametro SEND: usa «Check Update» sull’endpoint operativo prima di testare.'
              : missing.length > 0
                ? `Parametri obbligatori mancanti: ${missing.join(', ')}. Compila Signature o le celle SEND (✓ per salvare).`
                : 'Impossibile avviare il test: verifica la tabella SEND e riprova.'
          );
          logBackendCallTest('runBulkTestOnFilledRows: skip (tabella non pronta dopo commit cella)');
          return false;
        }
        return true;
      },
      [
        allMockInputInternalNames.length,
        commitPendingCellEdit,
        endpointInvocationFallback,
        getRowsForTest,
        mappingSend,
      ]
    );

    const lastHandledBulkNonce = useRef(0);
    useEffect(() => {
      if (bulkTestNonce == null || bulkTestNonce <= 0) return;
      if (bulkTestNonce === lastHandledBulkNonce.current) return;
      lastHandledBulkNonce.current = bulkTestNonce;
      logBackendCallTest('MockTable: effetto bulkTestNonce', { bulkTestNonce });
      void (async () => {
        onBulkTestStart?.();
        let result: 'ok' | 'skipped' = 'ok';
        try {
          if (!runBulkPreflightOrSkip((msg) => onBulkTestSkipped?.(msg))) {
            result = 'skipped';
            return;
          }
          await runBulkTestOnFilledRows(false);
        } finally {
          onBulkTestEnd?.(result);
        }
      })();
    }, [
      bulkTestNonce,
      runBulkTestOnFilledRows,
      runBulkPreflightOrSkip,
      onBulkTestStart,
      onBulkTestEnd,
      onBulkTestSkipped,
    ]);

    const lastHandledGatewayBulkNonce = useRef(0);
    useEffect(() => {
      if (bulkGatewayTestNonce == null || bulkGatewayTestNonce <= 0) return;
      if (bulkGatewayTestNonce === lastHandledGatewayBulkNonce.current) return;
      lastHandledGatewayBulkNonce.current = bulkGatewayTestNonce;
      logBackendCallTest('MockTable: effetto bulkGatewayTestNonce', { bulkGatewayTestNonce });
      void (async () => {
        onBulkTestStart?.();
        let result: 'ok' | 'skipped' = 'ok';
        try {
          if (!String(convaiGatewayPublicUrl ?? '').trim()) {
            onBulkTestSkipped?.(
              'Test via gateway: URL mancante. Apri il backend dal tab Backends dell’agente AI (serve projectId + agentTaskId).'
            );
            result = 'skipped';
            return;
          }
          if (!runBulkPreflightOrSkip((msg) => onBulkTestSkipped?.(msg))) {
            result = 'skipped';
            return;
          }
          await runBulkTestOnFilledRows(true);
        } finally {
          onBulkTestEnd?.(result);
        }
      })();
    }, [
      bulkGatewayTestNonce,
      convaiGatewayPublicUrl,
      runBulkTestOnFilledRows,
      runBulkPreflightOrSkip,
      onBulkTestStart,
      onBulkTestEnd,
      onBulkTestSkipped,
    ]);

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
      onMockTableRecipe(applyCellEditRecipe);
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {bulkPayloadHint ? (
            <div
              className="shrink-0 border-b border-amber-600/40 bg-amber-950/40 px-4 py-2 text-xs text-amber-100/95"
              role="status"
            >
              {bulkPayloadHint}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <table className="border-collapse" style={{ tableLayout: 'auto', width: 'auto' }}>
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="sticky left-0 top-0 z-30 min-w-[40px] border-b border-slate-700 bg-slate-800 px-1 py-2 text-left text-xs font-semibold text-slate-400 shadow-[0_1px_0_0_rgba(15,23,42,0.9)]">
                    #
                  </th>
                  {visibleInputColumns.map((col) => {
                    const isParked = !col.isActive;
                    const variable = variableLabelByColumn(col.name, 'input');
                    return (
                      <th
                        key={`in_${col.name}`}
                        className={`sticky top-0 z-20 whitespace-nowrap border-l border-t-2 border-b-2 border-slate-700 px-2 py-2 text-left text-xs font-semibold shadow-[0_1px_0_0_rgba(15,23,42,0.9)] ${
                          isParked
                            ? 'bg-slate-800 text-slate-500'
                            : 'border-cyan-500 bg-cyan-950 text-cyan-400'
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
                        className={`sticky top-0 z-20 whitespace-nowrap border-l border-t-2 border-b-2 border-slate-700 px-2 py-2 text-left text-xs font-semibold shadow-[0_1px_0_0_rgba(15,23,42,0.9)] ${
                          isParked
                            ? 'bg-slate-800 text-slate-500'
                            : 'border-green-500 bg-emerald-950 text-green-400'
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
                  <th className="sticky top-0 z-20 min-w-[88px] border-b border-l border-slate-700 bg-slate-800 px-1 py-2 text-center text-xs font-semibold text-slate-400 shadow-[0_1px_0_0_rgba(15,23,42,0.9)]">
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
                  const showRowIncomplete =
                    Boolean(highlightIncompleteRows) &&
                    allMockInputInternalNames.length > 0 &&
                    isBackendMockRowIncompleteForBulkTest(
                      row,
                      mappingSend,
                      endpointInvocationFallback ?? {}
                    );
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-700 hover:bg-slate-800/50 ${
                      showRowIncomplete ? 'ring-2 ring-inset ring-red-600/90' : ''
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-slate-900 px-1 py-2 align-top text-center text-xs text-slate-400">
                      <div className="flex items-start justify-center gap-1">
                        {errorByRowId[row.id] ? (
                          <span
                            className="mt-0.5 shrink-0 cursor-help text-red-500"
                            title={errorByRowId[row.id]}
                            role="img"
                            aria-label={`Errore test: ${errorByRowId[row.id]}`}
                          >
                            <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block w-[14px] shrink-0" aria-hidden />
                        )}
                        <span>{rowIndex + 1}</span>
                      </div>
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
                            isLoading={Boolean(loadingByRowId[row.id])}
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
          <div className="flex shrink-0 justify-end border-t border-slate-700 px-4 py-2">
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
