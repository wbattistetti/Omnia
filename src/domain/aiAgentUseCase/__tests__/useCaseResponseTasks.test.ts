import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  createSayMessageTaskRow,
  ensureUseCaseResponse,
  getMessageTextFromResponseTasks,
  mapTasksUpdatingMessageText,
  mapUseCasesWithResponseTasksUpdaters,
  patchUseCaseResponseTasks,
  syncAssistantDialogueFromResponseTasks,
} from '../useCaseResponseTasks';

function minimalUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao mondo', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('ensureUseCaseResponse', () => {
  it('seeds sayMessage from assistant dialogue when response missing', () => {
    const uc = ensureUseCaseResponse(minimalUseCase());
    expect(uc.response?.tasks).toHaveLength(1);
    expect(uc.response?.tasks[0].templateId).toBe('sayMessage');
    expect(getMessageTextFromResponseTasks(uc.response!.tasks)).toBe('Ciao mondo');
  });

  it('keeps existing response tasks', () => {
    const row = createSayMessageTaskRow('Altro');
    const uc = minimalUseCase({ response: { tasks: [row] } });
    expect(ensureUseCaseResponse(uc).response?.tasks[0]).toEqual(row);
  });
});

describe('patchUseCaseResponseTasks', () => {
  it('syncs dialogue assistant content from message task', () => {
    const uc = minimalUseCase();
    const row = {
      ...createSayMessageTaskRow('Nuovo testo'),
      type: TaskType.SayMessage,
    };
    const next = patchUseCaseResponseTasks(uc, [row]);
    expect(next.dialogue.find((t) => t.role === 'assistant')?.content).toBe('Nuovo testo');
  });
});

describe('mapTasksUpdatingMessageText', () => {
  it('updates text on existing sayMessage row', () => {
    const uc = ensureUseCaseResponse(minimalUseCase());
    const tasks = mapTasksUpdatingMessageText(uc.response!.tasks, 'Nuovo');
    expect(getMessageTextFromResponseTasks(tasks)).toBe('Nuovo');
  });
});

describe('mapUseCasesWithResponseTasksUpdaters', () => {
  it('chains multiple palette-style appends on the same use case', () => {
    const list = [minimalUseCase()];
    const next = mapUseCasesWithResponseTasksUpdaters(list, 'uc-1', [
      (prev) => [...prev, { id: 'a', type: TaskType.WriteToBackend, templateId: 'writeToBackend', parameters: [] }],
      (prev) => [...prev, { id: 'b', type: TaskType.SendSMS, templateId: 'sendSMS', parameters: [] }],
    ]);
    expect(next[0].response?.tasks).toHaveLength(3);
    expect(next[0].response?.tasks.map((t) => t.templateId)).toEqual([
      'sayMessage',
      'writeToBackend',
      'sendSMS',
    ]);
  });
});

describe('syncAssistantDialogueFromResponseTasks', () => {
  it('no-ops when content unchanged', () => {
    const uc = minimalUseCase();
    const same = syncAssistantDialogueFromResponseTasks(
      uc,
      [createSayMessageTaskRow('Ciao mondo')]
    );
    expect(same).toBe(uc);
  });
});
