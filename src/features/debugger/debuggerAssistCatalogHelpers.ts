/**
 * Legge dal catalogo use case del task (JSON agent) payoff ed esempio assistente per il debugger flow.
 */

import { buildTaskSnapshotFromRaw } from '@taskEditor/EditorHost/editors/aiAgentEditor/buildTaskSnapshot';
import { parseAgentUseCasesJson } from '@types/aiAgentUseCases';
import type { AnalyzeDebuggerTurnUseCaseResult } from '@domain/aiAgentDebugger/analyzeDebuggerTurnUseCaseResult';
import { taskRepository } from '@services/TaskRepository';

export type DebuggerAssistTask = NonNullable<ReturnType<typeof taskRepository.getTask>>;

function findUseCaseRow(task: DebuggerAssistTask | null, useCaseId: string | null | undefined) {
  if (!task || !useCaseId?.trim()) return null;
  try {
    const snap = buildTaskSnapshotFromRaw(task);
    const list = parseAgentUseCasesJson(snap.agentUseCasesJson);
    return list.find((x) => x.id === useCaseId.trim()) ?? null;
  } catch {
    return null;
  }
}

/** Label UC dal catalogo (fallback coerente con FlowBotTurnLabel). */
export function resolveCatalogLabelForTaskUseCase(
  task: DebuggerAssistTask | null,
  useCaseId: string | null | undefined
): string | null {
  const u = findUseCaseRow(task, useCaseId);
  const lab = typeof u?.label === 'string' ? u.label.trim() : '';
  return lab.length > 0 ? lab : null;
}

/** Payoff narrativo dello UC nel catalogo. */
export function resolveCatalogPayoffForTaskUseCase(
  task: DebuggerAssistTask | null,
  useCaseId: string | null | undefined
): string | null {
  const u = findUseCaseRow(task, useCaseId);
  const p = typeof u?.payoff === 'string' ? u.payoff.trim() : '';
  return p.length > 0 ? p : null;
}

/** Prima battuta assistente dello UC (dialogue). */
export function resolveCatalogAssistantExampleForTaskUseCase(
  task: DebuggerAssistTask | null,
  useCaseId: string | null | undefined
): string | null {
  const u = findUseCaseRow(task, useCaseId);
  if (!u?.dialogue || !Array.isArray(u.dialogue)) return null;
  const assistant = u.dialogue.find((t) => t.role === 'assistant');
  const content = typeof assistant?.content === 'string' ? assistant.content.trim() : '';
  return content.length > 0 ? content : null;
}

/**
 * Testo per «Esempio di risposta corretta»: priorità esempio catalogo se c’è UC riconosciuto,
 * altrimenti battuta IA / scenario suggerito.
 */
export function resolveDebuggerPrefillCorrectReply(
  task: DebuggerAssistTask | null,
  data: AnalyzeDebuggerTurnUseCaseResult
): string | null {
  const ia =
    typeof data.correct_assistant_reply_it === 'string' && data.correct_assistant_reply_it.trim()
      ? data.correct_assistant_reply_it.trim()
      : null;
  const sugLine =
    data.suggested_use_case &&
    typeof data.suggested_use_case.assistant_example_line === 'string' &&
    data.suggested_use_case.assistant_example_line.trim()
      ? data.suggested_use_case.assistant_example_line.trim()
      : null;

  if (data.recognized_use_case_id?.trim()) {
    const fromCatalog = resolveCatalogAssistantExampleForTaskUseCase(task, data.recognized_use_case_id);
    if (fromCatalog) return fromCatalog;
    return ia ?? sugLine ?? null;
  }

  return ia ?? sugLine ?? null;
}
