/**
 * Hook: esecuzione per riga mock table (MOCK emula output locali; REAL = HTTP via proxy).
 * «Test API» in toolbar chiama sempre HTTP (`runRow(id, { forceHttp: true })`), anche se MOCK è attivo.
 * Audit: `testRun.lastResponse` sovrascrive l’ultima risposta per riga.
 */

import { useCallback, useRef, useState } from 'react';
import {
  BackendExecutionMode,
  type BackendMockTableRow,
  type BackendMockTableRowTestRun,
} from '../domain/backendTest/backendTestRowTypes';
import { buildSendHttpRequest } from '../utils/backendCall/buildSendHttpRequest';
import { mapJsonResponseToWireOutputs } from '../utils/backendCall/mapJsonResponseToWireOutputs';
import {
  forwardBackendCallViaProxy,
  BACKEND_CALL_PROXY_ENVELOPE_NOT_JSON,
  type BackendCallProxyResponse,
} from '../services/backendCallTestProxyApi';
import { stableJsonStringify } from '../utils/stableJsonStringify';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import type { BackendOutputDef } from '../utils/backendCall/mapJsonResponseToWireOutputs';
import { logBackendCallTest } from '../debug/backendCallTestDebug';

function mergeRow(prev: BackendMockTableRow, patch: Partial<BackendMockTableRow>): BackendMockTableRow {
  const pt = patch.testRun;
  const nextTest: BackendMockTableRowTestRun = {
    ...(prev.testRun ?? {}),
    ...(pt ?? {}),
    executionMode: pt?.executionMode ?? prev.testRun?.executionMode ?? BackendExecutionMode.MOCK,
    notes: { ...(prev.testRun?.notes ?? {}), ...(pt?.notes ?? {}) },
  };
  return {
    ...prev,
    ...patch,
    inputs: patch.inputs ?? prev.inputs,
    outputs: patch.outputs ?? prev.outputs,
    testRun: nextTest,
  };
}

/** Messaggio esplicito per corpo non JSON (HTML, 204, testo grezzo). */
function formatNonJsonResponseError(proxy: BackendCallProxyResponse): string {
  const raw = (proxy.bodyText || '').trim();
  const preview = raw.slice(0, 120).replace(/\s+/g, ' ');
  const looksHtml = /^\s*</.test(raw) || raw.toLowerCase().includes('<!doctype');
  const emptyish = proxy.status === 204 || raw.length === 0;
  const hint = looksHtml
    ? 'Il server ha restituito HTML (pagina di errore o login), non JSON.'
    : emptyish
      ? 'Corpo vuoto o assente (es. 204): atteso JSON dal backend.'
      : 'Il corpo non è JSON valido.';
  const tail = raw.length > 120 ? '…' : '';
  return `Risposta non JSON (HTTP ${proxy.status}). ${hint}${preview ? ` Anteprima: ${preview}${tail}` : ''}`;
}

function pickPreviewFromOutputs(outputs: Record<string, unknown>): string | undefined {
  for (const v of Object.values(outputs)) {
    if (Array.isArray(v)) {
      const slice = v.slice(0, 3).map((x) => stableJsonStringify(x));
      const more = v.length > 3 ? ` …(+${v.length - 3})` : '';
      return `[${slice.join(', ')}${more}]`;
    }
  }
  const keys = Object.keys(outputs);
  if (keys.length === 0) return undefined;
  const s = stableJsonStringify(outputs);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

export type UseBackendTestRunParams = {
  getRows: () => BackendMockTableRow[];
  /** Aggiornamento funzionale della mock table (sicuro con Promise.all su righe diverse). */
  onRowsUpdate: (recipe: (prev: BackendMockTableRow[]) => BackendMockTableRow[]) => void;
  defaultExecutionMode: BackendExecutionMode;
  endpointUrl: string;
  endpointMethod: string;
  endpointHeaders?: Record<string, string>;
  sendEntries: MappingEntry[];
  outputDefs: BackendOutputDef[];
};

export function useBackendTestRun(params: UseBackendTestRunParams) {
  const pRef = useRef(params);
  pRef.current = params;

  const [loadingByRowId, setLoadingByRowId] = useState<Record<string, boolean>>({});
  const [errorByRowId, setErrorByRowId] = useState<Record<string, string | undefined>>({});

  const patchRow = useCallback((rowId: string, patch: Partial<BackendMockTableRow>) => {
    const p = pRef.current;
    p.onRowsUpdate((rows) => rows.map((r) => (r.id === rowId ? mergeRow(r, patch) : r)));
  }, []);

  const runRow = useCallback(async (rowId: string, options?: { forceHttp?: boolean }) => {
    const p = pRef.current;
    const row = p.getRows().find((r) => r.id === rowId);
    if (!row) {
      logBackendCallTest('runRow: riga non trovata', { rowId });
      return;
    }

    const userMode: BackendExecutionMode =
      row.testRun?.executionMode ?? p.defaultExecutionMode ?? BackendExecutionMode.MOCK;
    const forceHttp = Boolean(options?.forceHttp);
    const useMockPath = !forceHttp && userMode === BackendExecutionMode.MOCK;

    logBackendCallTest('runRow: inizio', {
      rowId,
      userMode,
      forceHttp,
      method: p.endpointMethod,
      url: p.endpointUrl,
    });

    setLoadingByRowId((m) => ({ ...m, [rowId]: true }));
    setErrorByRowId((m) => ({ ...m, [rowId]: undefined }));
    const ts = new Date().toISOString();

    try {
      if (useMockPath) {
        const rawJson = stableJsonStringify(row.outputs ?? {});
        const preview = pickPreviewFromOutputs((row.outputs ?? {}) as Record<string, unknown>);
        patchRow(rowId, {
          testRun: {
            executionMode: userMode,
            lastResponse: { rawJson, preview },
            lastTestedAt: ts,
          },
        });
        logBackendCallTest('runRow: MOCK completato', { rowId, lastTestedAt: ts });
        return;
      }

      const built = buildSendHttpRequest({
        endpointUrl: p.endpointUrl,
        method: p.endpointMethod,
        endpointHeaders: p.endpointHeaders,
        sendEntries: p.sendEntries,
        rowInputs: (row.inputs ?? {}) as Record<string, unknown>,
      });

      const proxy = await forwardBackendCallViaProxy(built);

      if (proxy.error === BACKEND_CALL_PROXY_ENVELOPE_NOT_JSON) {
        const hint =
          import.meta.env.DEV && typeof window !== 'undefined'
            ? ' In sviluppo avvia Express su :3100 (`npm run be:express` o `dev:beNew`) e Vite con URL relativo (proxy `/api/designer` → :3100).'
            : ' Verifica che il backend sia raggiungibile.';
        const preview = (proxy.bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        throw new Error(
          `${BACKEND_CALL_PROXY_ENVELOPE_NOT_JSON}: risposta proxy non è JSON (HTTP ${proxy.status}).${hint}` +
            (preview ? ` Anteprima: ${preview}${proxy.bodyText && proxy.bodyText.length > 200 ? '…' : ''}` : '')
        );
      }

      const bodyForTarget = (proxy.bodyText ?? '').trim();
      if (proxy.error && bodyForTarget === '') {
        throw new Error(proxy.error);
      }

      let parsed: unknown = null;
      try {
        parsed = bodyForTarget ? (JSON.parse(proxy.bodyText) as unknown) : null;
      } catch {
        throw new Error(formatNonJsonResponseError(proxy));
      }

      const mapped =
        parsed !== null
          ? mapJsonResponseToWireOutputs(parsed, p.outputDefs)
          : ({} as Record<string, unknown>);

      const nextOutputs = { ...(row.outputs ?? {}), ...mapped } as Record<string, unknown>;
      const rawJson =
        parsed !== null ? stableJsonStringify(parsed) : stableJsonStringify({ bodyText: proxy.bodyText });
      const preview =
        pickPreviewFromOutputs(nextOutputs) ?? (rawJson.length > 120 ? `${rawJson.slice(0, 120)}…` : rawJson);

      patchRow(rowId, {
        outputs: nextOutputs,
        testRun: {
          executionMode: userMode,
          lastResponse: {
            status: proxy.status,
            rawJson,
            preview,
            ...(proxy.error ? { error: proxy.error } : {}),
          },
          lastTestedAt: ts,
        },
      });
      logBackendCallTest('runRow: HTTP completato', {
        rowId,
        status: proxy.status,
        lastTestedAt: ts,
        forceHttp,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logBackendCallTest('runRow: errore', { rowId, message: msg, forceHttp });
      setErrorByRowId((m) => ({ ...m, [rowId]: msg }));
      patchRow(rowId, {
        testRun: {
          executionMode: userMode,
          lastResponse: {
            rawJson: stableJsonStringify({ error: msg }),
            preview: msg,
            error: msg,
          },
          lastTestedAt: ts,
        },
      });
    } finally {
      setLoadingByRowId((m) => ({ ...m, [rowId]: false }));
    }
  }, [patchRow]);

  const runAllParallel = useCallback(async () => {
    const ids = pRef.current.getRows().map((r) => r.id);
    await Promise.all(ids.map((id) => runRow(id)));
  }, [runRow]);

  return { loadingByRowId, errorByRowId, runRow, runAllParallel };
}
