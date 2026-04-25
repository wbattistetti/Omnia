/**
 * Console trace for IA Agent + ElevenLabs (ConvAI) end-to-end validation.
 * Filter DevTools by `IA·ConvAI` to see only this pipeline (compile → ApiServer → debugger).
 */

import { TaskType } from '../../types/taskTypes';

const PREFIX = '[IA·ConvAI]';

/** Shorten ids for logs (ConvAI agent ids are not secrets but avoid full dump). */
export function iaConvaiMaskId(value: string, visibleChars = 8): string {
  const s = String(value || '').trim();
  if (!s) return '(empty)';
  if (s.length <= visibleChars) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, visibleChars)}…`;
}

/** Snapshot of Settings → Runtime IA Agent (localStorage) at compile time. */
export function iaConvaiTraceGlobalIaDefaultsSnapshot(platform: string, convaiAgentIdTrimmedChars: number): void {
  console.info(`${PREFIX} global IA defaults (localStorage)`, {
    platform,
    convaiAgentIdChars: convaiAgentIdTrimmedChars,
  });
}

/** Which row produced this AI Agent row in `tasks[]` for POST /api/runtime/compile. */
export function iaConvaiTraceCompileTaskSource(
  taskId: string,
  slot: 'canvas-instance' | 'template-catalog',
  stats: {
    agentIaRuntimeOverrideJsonChars: number;
    hasAgentIaRuntimeOverrideKey: boolean;
  }
): void {
  console.info(`${PREFIX} compile task source`, { taskId, slot, ...stats });
}

/**
 * Compares `agentIaRuntimeOverrideJson` on the compile row vs fresh `taskRepository.getTask`
 * (same tick) to detect stale canvas / hydration skew.
 */

/** After persisting IA runtime JSON to TaskRepository (`agentIaRuntimeOverrideJson`). */
export function iaConvaiTracePersistTaskRepository(taskId: string, storedOverrideJson: string): void {
  const peek = peekConvaiAgentIdInStoredJson(storedOverrideJson);
  console.info(`${PREFIX} persist → TaskRepository`, {
    taskId,
    convaiAgentIdKeyInJson: peek.convaiAgentIdKeyInJson,
    convaiAgentIdRawTrimmedChars: peek.convaiAgentIdRawTrimmedChars,
    jsonLength: storedOverrideJson.trim().length,
  });
}

function peekConvaiAgentIdInStoredJson(raw: string): {
  convaiAgentIdKeyInJson: boolean;
  convaiAgentIdRawTrimmedChars: number;
} {
  const t = raw.trim();
  if (!t.length) {
    return { convaiAgentIdKeyInJson: false, convaiAgentIdRawTrimmedChars: 0 };
  }
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const hasKey = Object.prototype.hasOwnProperty.call(o, 'convaiAgentId');
    const v = o.convaiAgentId;
    const chars = typeof v === 'string' ? v.trim().length : 0;
    return { convaiAgentIdKeyInJson: hasKey, convaiAgentIdRawTrimmedChars: chars };
  } catch {
    return {
      convaiAgentIdKeyInJson: t.includes('"convaiAgentId"'),
      convaiAgentIdRawTrimmedChars: 0,
    };
  }
}

export function iaConvaiTraceCompileVsRepository(
  taskId: string,
  stats: {
    repoTaskFound: boolean;
    rowOverrideChars: number;
    repoOverrideChars: number;
    overridesIdentical: boolean;
  }
): void {
  const mismatch = !stats.overridesIdentical && stats.repoTaskFound;
  const logFn = mismatch ? console.warn : console.info;
  logFn(`${PREFIX} compile row vs TaskRepository`, { taskId, ...stats });
}

/**
 * Why `agentId` / globals ended up empty or filled — filter `[IA·ConvAI]` to debug ConvAI id gaps.
 */
export function iaConvaiTraceElevenLabsFieldResolution(
  taskId: string,
  detail: {
    rawOverrideChars: number;
    parseOk: boolean;
    parseFailedWithNonEmptyRaw: boolean;
    iaPlatformAfterNormalize?: string;
    convaiPresentOnTask: boolean;
    /** From raw JSON: key exists and trimmed string length before normalize drops empties. */
    convaiAgentIdKeyInJson: boolean;
    convaiAgentIdRawTrimmedChars: number;
    globalPlatform: string;
    convaiPresentInGlobalDefaults: boolean;
    resolvedAgentIdChars: number;
    agentIdSource: 'session' | 'task' | 'global' | 'none';
  }
): void {
  const empty = detail.resolvedAgentIdChars === 0;
  const logFn = empty ? console.warn : console.info;
  logFn(`${PREFIX} ElevenLabs field resolution`, { taskId, ...detail });
  if (empty) {
    console.warn(
      `${PREFIX} hint: Esegui il flusso (compile pre-run) per provisionare ConvAI in sessione, oppure «Crea agente» nel pannello IA Runtime. ` +
        `L’agent_id non è più persistito sul task: resta in memoria fino al reload tab.`
    );
  }
}

/** After building minimal compile DTO for one AI Agent task (ElevenLabs branch). */
export function iaConvaiTraceCompilePayload(
  taskId: string,
  payload: {
    platform?: string;
    agentId?: string;
    backendBaseUrl?: string;
    llmEndpoint?: string;
  }
): void {
  const isEl = payload.platform === 'elevenlabs';
  if (!isEl) return;
  console.info(`${PREFIX} compile task payload (ElevenLabs)`, {
    taskId,
    platform: payload.platform,
    agentId: payload.agentId ? iaConvaiMaskId(payload.agentId, 10) : '(missing — set ElevenLabs Agent ID in IA Runtime)',
    backendBaseUrl: payload.backendBaseUrl?.trim() || '(default: ApiServer base from VB env)',
    llmBridgeUrl: payload.llmEndpoint?.trim() ? '(set)' : '(default)',
  });
}

/** After merging all flow/subflow tasks for orchestrator POST — lists ElevenLabs agents in graph. */
export function iaConvaiTraceMergedCompileTasks(rootFlowId: string, tasks: unknown[]): void {
  const rows: Array<{
    taskId: string;
    label: string;
    agentIdMasked: string;
    backendBaseUrl: string;
  }> = [];

  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (o.type !== TaskType.AIAgent) continue;
    if (o.platform !== 'elevenlabs') continue;
    const id = String(o.id || '').trim();
    const label = String(o.label ?? '').trim() || '(no label)';
    const agentId = typeof o.agentId === 'string' ? o.agentId.trim() : '';
    const backendBaseUrl = typeof o.backendBaseUrl === 'string' ? o.backendBaseUrl.trim() : '';
    rows.push({
      taskId: id,
      label,
      agentIdMasked: agentId ? iaConvaiMaskId(agentId, 10) : '(missing)',
      backendBaseUrl: backendBaseUrl || '(default)',
    });
  }

  if (rows.length === 0) return;

  console.info(`${PREFIX} merged compile: ElevenLabs IA Agent row(s) for orchestrator`, {
    rootFlowId,
    count: rows.length,
    tasks: rows,
  });

  for (const r of rows) {
    if (r.agentIdMasked === '(missing)') {
      console.warn(
        `${PREFIX} compile warning: ElevenLabs platform but no agentId — ConvAI startAgent will fail until Agent ID is set`,
        { taskId: r.taskId, label: r.label }
      );
    }
  }
}

export function iaConvaiTraceSessionStart(rootFlowId: string, tasks: unknown[]): void {
  let has = false;
  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (o.type === TaskType.AIAgent && o.platform === 'elevenlabs') {
      has = true;
      break;
    }
  }
  if (!has) return;
  console.info(`${PREFIX} flow run: opening orchestrator session (SSE) — graph includes ElevenLabs IA Agent`, {
    rootFlowId,
  });
}
