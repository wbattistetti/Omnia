/**
 * Payload SSE `backendCallDiagnostic` dall'orchestrator .NET (task BackendCall / mockTable).
 */

export type FlowBackendParamRow = { name: string; value: unknown };

export type FlowBackendCallInvocation = {
  taskId: string;
  displayName: string;
  endpoint: string;
  method: string;
  outcome: 'success' | 'no_match' | 'ambiguous' | 'no_mock';
  matchedRowId?: string | null;
  errorMessage?: string | null;
  inputParameters: FlowBackendParamRow[];
  outputParameters: FlowBackendParamRow[];
  listPreviewLimit?: number;
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
    outcomeRaw === 'no_mock'
      ? outcomeRaw
      : 'success';
  const ep = o.endpoint ?? (o as { Endpoint?: unknown }).Endpoint;
  const meth = o.method ?? (o as { Method?: unknown }).Method;
  const mrid = o.matchedRowId ?? (o as { MatchedRowId?: unknown }).MatchedRowId;
  const err = o.errorMessage ?? (o as { ErrorMessage?: unknown }).ErrorMessage;
  const inp = o.inputParameters ?? (o as { InputParameters?: unknown }).InputParameters;
  const outp = o.outputParameters ?? (o as { OutputParameters?: unknown }).OutputParameters;
  const limRaw = o.listPreviewLimit ?? (o as { ListPreviewLimit?: unknown }).ListPreviewLimit;

  return {
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
  };
}
