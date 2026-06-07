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
    agentIdSource: 'session' | 'link' | 'task' | 'global' | 'none';
    deployLinkAgentIdChars?: number;
    kbDeterministic?: boolean;
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

/** kb_deterministic ma compile ha scelto ramo LLM — spiega perché (manca link/sessione/platform). */
export function iaConvaiTraceCompileLlmBranchWarning(
  taskId: string,
  detail: {
    deployMode: string;
    hasDeployLink: boolean;
    hasSessionAgent: boolean;
    overridePlatform?: string;
    globalPlatform: string;
  }
): void {
  console.warn(`${PREFIX} compile → ramo LLM (VB userà /api/runtime/ai-agent/step, NON ElevenLabs)`, {
    taskId,
    ...detail,
    fix:
      'Deploy agente (link sul task) poi Test; oppure verifica agentElevenLabsConvaiLinkJson / sessione ConvAI post-provision.',
  });
}

function readCompiledAiAgentPlatform(o: Record<string, unknown>): string {
  const raw = o.platform ?? o.Platform;
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  if (typeof raw === 'number' && raw === 1) return 'elevenlabs';
  return '';
}

function isCompiledAiAgentRow(o: Record<string, unknown>): boolean {
  const typ = o.taskType ?? o.TaskType ?? o.type ?? o.Type ?? o.templateId ?? o.TemplateId;
  return (
    typ === TaskType.AIAgent ||
    typ === 'AIAgent' ||
    typ === 'aiAgent' ||
    Number(typ) === 6
  );
}

/** Verità runtime: task AI Agent nel JSON restituito dal compilatore VB (compilationResult.tasks). */
export function iaConvaiTraceCompiledFlowAiAgents(
  rootFlowId: string,
  compileJson: Record<string, unknown> | undefined
): void {
  const tasks = compileJson?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) return;

  const rows: Array<{
    taskId: string;
    platform: string;
    agentIdMasked: string;
    llmEndpoint: string;
    convaiSession: string;
  }> = [];

  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (!isCompiledAiAgentRow(o)) continue;
    const taskId = String(o.id ?? o.Id ?? '').trim() || '(no-id)';
    const platform = readCompiledAiAgentPlatform(o) || '(missing → VB default OpenAI/LLM)';
    const agentId = typeof (o.agentId ?? o.AgentId) === 'string' ? String(o.agentId ?? o.AgentId).trim() : '';
    const llm = typeof (o.llmEndpoint ?? o.LlmEndpoint) === 'string' ? String(o.llmEndpoint ?? o.LlmEndpoint).trim() : '';
    const sid =
      typeof (o.convaiSessionConversationId ?? o.ConvaiSessionConversationId) === 'string'
        ? String(o.convaiSessionConversationId ?? o.ConvaiSessionConversationId).trim()
        : '';
    rows.push({
      taskId,
      platform,
      agentIdMasked: agentId ? iaConvaiMaskId(agentId, 10) : '(none)',
      llmEndpoint: llm || '(default :3100/step)',
      convaiSession: sid ? iaConvaiMaskId(sid, 12) : '(none)',
    });
  }

  if (rows.length === 0) return;

  console.info(`${PREFIX} VB compiled flow — AI Agent task(s) (runtime branch)`, {
    rootFlowId,
    count: rows.length,
    tasks: rows,
  });

  for (const r of rows) {
    if (r.platform !== 'elevenlabs') {
      console.warn(
        `${PREFIX} VB runtime userà ramo LLM/Groq per questo task (platform=${r.platform}) — omnia_dialog_step ok da ConvAI non implica che VB sia su ElevenLabs`,
        r
      );
    }
  }
}

/** Dopo merge `mergedTasks` per POST orchestrator — tutti gli AI Agent con platform effettiva. */
export function iaConvaiTraceMergedCompileTasks(rootFlowId: string, tasks: unknown[]): void {
  const rows: Array<{
    taskId: string;
    label: string;
    platform: string;
    agentIdMasked: string;
    deployMode: string;
  }> = [];

  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    if (o.type !== TaskType.AIAgent) continue;
    const id = String(o.id || '').trim();
    const label = String(o.label ?? '').trim() || '(no label)';
    const platform =
      typeof o.platform === 'string' && o.platform.trim()
        ? o.platform.trim().toLowerCase()
        : '(missing → LLM)';
    const agentId = typeof o.agentId === 'string' ? o.agentId.trim() : '';
    const deployMode =
      typeof o.agentConvaiDeployMode === 'string' ? o.agentConvaiDeployMode.trim() : '(default kb_deterministic)';
    rows.push({
      taskId: id,
      label,
      platform,
      agentIdMasked: agentId ? iaConvaiMaskId(agentId, 10) : '(none)',
      deployMode,
    });
  }

  if (rows.length === 0) return;

  console.info(`${PREFIX} mergedTasks per orchestrator POST`, {
    rootFlowId,
    count: rows.length,
    tasks: rows,
  });

  for (const r of rows) {
    if (r.platform !== 'elevenlabs') {
      console.warn(`${PREFIX} mergedTasks: AI Agent senza platform elevenlabs`, r);
    } else if (r.agentIdMasked === '(none)') {
      console.warn(`${PREFIX} mergedTasks: ElevenLabs ma agentId mancante`, r);
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
