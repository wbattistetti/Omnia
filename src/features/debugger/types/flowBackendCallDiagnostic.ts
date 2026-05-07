/**
 * Payload SSE `backendCallDiagnostic` dall'orchestrator .NET (task BackendCall / mockTable).
 */

export type FlowBackendParamRow = { name: string; value: unknown };

export type FlowBackendCallInvocation = {
  taskId: string;
  displayName: string;
  endpoint: string;
  method: string;
  outcome: 'success' | 'no_match' | 'ambiguous' | 'no_mock' | 'http_success' | 'http_error';
  matchedRowId?: string | null;
  errorMessage?: string | null;
  inputParameters: FlowBackendParamRow[];
  outputParameters: FlowBackendParamRow[];
  listPreviewLimit?: number;
  /** Status HTTP effettivo (orchestratore .NET). */
  httpStatus?: number | null;
  /** Anteprima body richiesta (truncate). */
  requestBodyPreview?: string | null;
  /** Anteprima body risposta (truncate). */
  responsePreview?: string | null;
  /** Da JSON risposta errore BookFromAgenda (`diagnostic`) o payload esteso. */
  diagnostic?: Record<string, unknown> | null;
  /** Catalogo osservabilità v1 (opzionale, da orchestrator): priorità su inferenza UI. */
  catalogEvent?: string;
  catalogHint?: string;
  catalogFields?: Record<string, string>;
};

function asRowArray(raw: unknown): FlowBackendParamRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FlowBackendParamRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const nameTok = o.name ?? (o as { Name?: unknown }).Name;
    const name = typeof nameTok === 'string' ? nameTok : String(nameTok ?? '');
    const val = o.value ?? (o as { Value?: unknown }).Value;
    out.push({ name, value: val });
  }
  return out;
}

/** Normalizza il payload SSE (Newtonsoft / camelCase) per UI debugger. */
export function parseFlowBackendCallInvocation(raw: unknown): FlowBackendCallInvocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const taskId =
    typeof o.taskId === 'string'
      ? o.taskId
      : typeof (o as { TaskId?: unknown }).TaskId === 'string'
        ? ((o as { TaskId: string }).TaskId)
        : '';
  if (!taskId.trim()) return null;
  const dn = o.displayName ?? (o as { DisplayName?: unknown }).DisplayName;
  const displayName =
    typeof dn === 'string' && dn.trim()
      ? dn.trim()
      : taskId.slice(0, 12);
  const outcomeRaw = o.outcome ?? (o as { Outcome?: unknown }).Outcome;
  const outcome =
    outcomeRaw === 'success' ||
    outcomeRaw === 'no_match' ||
    outcomeRaw === 'ambiguous' ||
    outcomeRaw === 'no_mock' ||
    outcomeRaw === 'http_success' ||
    outcomeRaw === 'http_error'
      ? outcomeRaw
      : 'success';
  const ep = o.endpoint ?? (o as { Endpoint?: unknown }).Endpoint;
  const meth = o.method ?? (o as { Method?: unknown }).Method;
  const mrid = o.matchedRowId ?? (o as { MatchedRowId?: unknown }).MatchedRowId;
  const err = o.errorMessage ?? (o as { ErrorMessage?: unknown }).ErrorMessage;
  const inp = o.inputParameters ?? (o as { InputParameters?: unknown }).InputParameters;
  const outp = o.outputParameters ?? (o as { OutputParameters?: unknown }).OutputParameters;
  const limRaw = o.listPreviewLimit ?? (o as { ListPreviewLimit?: unknown }).ListPreviewLimit;

  const httpStatusRaw = o.httpStatus ?? (o as { HttpStatus?: unknown }).HttpStatus;
  const httpStatus =
    typeof httpStatusRaw === 'number' && Number.isFinite(httpStatusRaw)
      ? Math.floor(httpStatusRaw)
      : null;

  const reqPrev = o.requestBodyPreview ?? (o as { RequestBodyPreview?: unknown }).RequestBodyPreview;
  const requestBodyPreview =
    typeof reqPrev === 'string' ? reqPrev : reqPrev != null ? String(reqPrev) : null;

  const respPrev = o.responsePreview ?? (o as { ResponsePreview?: unknown }).ResponsePreview;
  const responsePreview =
    typeof respPrev === 'string' ? respPrev : respPrev != null ? String(respPrev) : null;

  let diagnostic: Record<string, unknown> | null = null;
  const diagRaw = o.diagnostic ?? (o as { Diagnostic?: unknown }).Diagnostic;
  if (diagRaw && typeof diagRaw === 'object' && !Array.isArray(diagRaw)) {
    diagnostic = diagRaw as Record<string, unknown>;
  } else if (typeof responsePreview === 'string' && responsePreview.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(responsePreview) as Record<string, unknown>;
      const d = parsed.diagnostic;
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        diagnostic = d as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }

  const catalogEventRaw =
    o.catalogEvent ??
    (o as { CatalogEvent?: unknown }).CatalogEvent ??
    o.integrationObservationEvent ??
    (o as { IntegrationObservationEvent?: unknown }).IntegrationObservationEvent;
  const catalogEvent =
    typeof catalogEventRaw === 'string' && catalogEventRaw.trim()
      ? catalogEventRaw.trim()
      : undefined;

  const catalogHintRaw =
    o.catalogHint ?? (o as { CatalogHint?: unknown }).CatalogHint ?? (o as { IntegrationObservationHint?: unknown }).IntegrationObservationHint;
  const catalogHint =
    typeof catalogHintRaw === 'string' && catalogHintRaw.trim() ? catalogHintRaw.trim() : undefined;

  let catalogFields: Record<string, string> | undefined;
  const cfRaw =
    o.catalogFields ??
    (o as { CatalogFields?: unknown }).CatalogFields ??
    o.integrationObservationFields ??
    (o as { IntegrationObservationFields?: unknown }).IntegrationObservationFields;
  if (cfRaw && typeof cfRaw === 'object' && !Array.isArray(cfRaw)) {
    const cf: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfRaw as Record<string, unknown>)) {
      if (v == null) continue;
      cf[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    if (Object.keys(cf).length > 0) catalogFields = cf;
  }

  const base = {
    taskId,
    displayName,
    endpoint: typeof ep === 'string' ? ep : '',
    method: typeof meth === 'string' ? meth : 'POST',
    outcome,
    matchedRowId: mrid != null ? String(mrid) : null,
    errorMessage: typeof err === 'string' ? err : null,
    inputParameters: asRowArray(inp),
    outputParameters: asRowArray(outp),
    listPreviewLimit: typeof limRaw === 'number' && limRaw > 0 ? Math.floor(limRaw) : 12,
    httpStatus,
    requestBodyPreview,
    responsePreview,
    diagnostic,
  };

  return {
    ...base,
    ...(catalogEvent ? { catalogEvent } : {}),
    ...(catalogHint ? { catalogHint } : {}),
    ...(catalogFields ? { catalogFields } : {}),
  };
}
