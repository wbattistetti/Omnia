/**
 * Use case operational response: ordered task list (same shape as escalation.tasks).
 * Message is a sayMessage row; not a separate top-level field.
 */

import { TaskType } from '@types/taskTypes';
import {
  getAssistantExample,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import type { TaskSequenceRow } from '@responseEditor/taskSequence/TaskSequenceEditor';
import { isMessageLikeEscalationTask } from '@responseEditor/utils/escalationHelpers';
import { getScalarParameterValue } from '@responseEditor/utils/taskUiText';

export interface AIAgentUseCaseResponse {
  tasks: TaskSequenceRow[];
}

function newTaskRowId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Default sayMessage task with inline text (no translation key). */
export function createSayMessageTaskRow(text: string): TaskSequenceRow {
  return {
    id: newTaskRowId(),
    type: TaskType.SayMessage,
    templateId: 'sayMessage',
    parameters: [{ parameterId: 'text', value: typeof text === 'string' ? text : '' }],
    iconName: 'MessageCircle',
  };
}

export function getUseCaseResponseTasks(useCase: AIAgentUseCase): TaskSequenceRow[] {
  return useCase.response?.tasks ?? [];
}

/** First message-like task text, or empty string. */
export function getMessageTextFromResponseTasks(tasks: readonly TaskSequenceRow[]): string {
  const msg = tasks.find((t) => isMessageLikeEscalationTask(t));
  if (!msg) return '';
  return getScalarParameterValue(msg, 'text').trim();
}

/**
 * Ensures `response.tasks` exists; seeds from assistant dialogue when empty.
 */
export function ensureUseCaseResponse(useCase: AIAgentUseCase): AIAgentUseCase {
  const existing = useCase.response?.tasks;
  if (Array.isArray(existing) && existing.length > 0) {
    return useCase;
  }
  const seedText = getAssistantExample(useCase);
  return {
    ...useCase,
    response: {
      tasks: [createSayMessageTaskRow(seedText)],
    },
  };
}

/**
 * Copies message task text into the assistant dialogue turn (wizard / conversations).
 */
export function syncAssistantDialogueFromResponseTasks(
  useCase: AIAgentUseCase,
  tasks: readonly TaskSequenceRow[]
): AIAgentUseCase {
  const messageText = getMessageTextFromResponseTasks(tasks);
  const assistantIdx = useCase.dialogue.findIndex((t) => t.role === 'assistant');
  if (assistantIdx < 0) {
    return useCase;
  }
  const turn = useCase.dialogue[assistantIdx];
  if (turn.content === messageText) {
    return useCase;
  }
  const dialogue = useCase.dialogue.map((t, i) =>
    i === assistantIdx ? { ...t, content: messageText, userEdited: true } : t
  );
  return { ...useCase, dialogue };
}

export function patchUseCaseResponseTasks(
  useCase: AIAgentUseCase,
  tasks: readonly TaskSequenceRow[]
): AIAgentUseCase {
  const withResponse: AIAgentUseCase = {
    ...useCase,
    response: { tasks: [...tasks] },
  };
  return syncAssistantDialogueFromResponseTasks(withResponse, tasks);
}

export type ResponseTasksUpdater = (
  prev: readonly TaskSequenceRow[]
) => readonly TaskSequenceRow[];

/** Applies one functional updater to a single use case (seeds `response` when missing). */
export function applyResponseTasksUpdater(
  useCase: AIAgentUseCase,
  updater: ResponseTasksUpdater
): AIAgentUseCase {
  const base = ensureUseCaseResponse(useCase);
  const nextTasks = updater(getUseCaseResponseTasks(base));
  return patchUseCaseResponseTasks(base, nextTasks);
}

/** Patches one use case inside a list; leaves siblings untouched. */
export function mapUseCasesWithResponseTasksUpdater(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string,
  updater: ResponseTasksUpdater
): AIAgentUseCase[] {
  return useCases.map((uc) =>
    uc.id === useCaseId ? applyResponseTasksUpdater(uc, updater) : uc
  );
}

/** Runs multiple updaters in order on the same use case (same-tick batching). */
export function mapUseCasesWithResponseTasksUpdaters(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string,
  updaters: readonly ResponseTasksUpdater[]
): AIAgentUseCase[] {
  let next = [...useCases];
  for (const updater of updaters) {
    next = mapUseCasesWithResponseTasksUpdater(next, useCaseId, updater);
  }
  return next;
}

export function parseUseCaseResponseField(raw: unknown): AIAgentUseCaseResponse | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.tasks)) return undefined;
  const tasks: TaskSequenceRow[] = [];
  for (const row of o.tasks) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const type = typeof r.type === 'number' ? r.type : null;
    const templateId =
      r.templateId === null
        ? null
        : typeof r.templateId === 'string'
          ? r.templateId
          : typeof r.id === 'string'
            ? r.id
            : null;
    if (type === null || templateId === undefined) continue;
    const parameters: TaskSequenceRow['parameters'] = [];
    if (Array.isArray(r.parameters)) {
      for (const p of r.parameters) {
        if (!p || typeof p !== 'object') continue;
        const po = p as Record<string, unknown>;
        const parameterId = typeof po.parameterId === 'string' ? po.parameterId : '';
        if (!parameterId) continue;
        parameters.push({ parameterId, value: po.value });
      }
    }
    tasks.push({
      id: typeof r.id === 'string' ? r.id : newTaskRowId(),
      type,
      templateId,
      parameters,
      ...(typeof r.color === 'string' ? { color: r.color } : {}),
      ...(typeof r.label === 'string' ? { label: r.label } : {}),
      ...(typeof r.iconName === 'string' ? { iconName: r.iconName } : {}),
    });
  }
  if (tasks.length === 0) return undefined;
  return { tasks };
}
