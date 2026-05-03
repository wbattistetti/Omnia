import { describe, expect, it } from 'vitest';
import {
  formatAgentUseCasesForProvisionModal,
  buildUseCaseDialoguesPreviewFromTask,
  mergeUseCaseExamplesIntoExamplesBody,
} from '../agentUseCasesProvisionPreviewFormat';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

describe('formatAgentUseCasesForProvisionModal', () => {
  it('formats labelled dialogues', () => {
    const text = formatAgentUseCasesForProvisionModal([
      {
        id: 'a',
        label: 'Happy path',
        parent_id: null,
        sort_order: 0,
        refinement_prompt: '',
        dialogue: [
          { turn_id: '1', role: 'user', content: ' Ciao ' },
          { turn_id: '2', role: 'assistant', content: 'Buongiorno.' },
        ],
        notes: { behavior: '', tone: '' },
        bubble_notes: {},
      },
    ]);
    expect(text).toContain('Happy path');
    expect(text).toContain('Utente: Ciao');
    expect(text).toContain('Assistente: Buongiorno.');
  });
});

describe('buildUseCaseDialoguesPreviewFromTask', () => {
  it('returns undefined when no use cases', () => {
    const task = {
      type: TaskType.AIAgent,
      agentUseCasesJson: '[]',
    } as unknown as Task;
    expect(buildUseCaseDialoguesPreviewFromTask(task)).toBeUndefined();
  });

  it('returns text when JSON has use cases', () => {
    const task = {
      type: TaskType.AIAgent,
      agentUseCasesJson: JSON.stringify([
        {
          id: 'x',
          label: 'S',
          parent_id: null,
          sort_order: 0,
          refinement_prompt: '',
          dialogue: [{ turn_id: 't', role: 'user', content: 'ok' }],
          notes: { behavior: '', tone: '' },
          bubble_notes: {},
        },
      ]),
    } as unknown as Task;
    const v = buildUseCaseDialoguesPreviewFromTask(task);
    expect(v).toBeDefined();
    expect(v!).toContain('Utente: ok');
  });
});

describe('mergeUseCaseExamplesIntoExamplesBody', () => {
  it('returns base when no use cases text', () => {
    expect(mergeUseCaseExamplesIntoExamplesBody('solo editor', { agentUseCasesJson: '[]' })).toBe('solo editor');
  });

  it('prepends use-case block when base empty', () => {
    const out = mergeUseCaseExamplesIntoExamplesBody('', {
      agentUseCasesJson: JSON.stringify([
        {
          id: 'u',
          label: 'A',
          parent_id: null,
          sort_order: 0,
          refinement_prompt: '',
          dialogue: [{ turn_id: 't', role: 'user', content: 'Hi' }],
          notes: { behavior: '', tone: '' },
          bubble_notes: {},
        },
      ]),
    });
    expect(out).toContain('Scenari use case');
    expect(out).toContain('Utente: Hi');
  });

  it('appends after base examples', () => {
    const out = mergeUseCaseExamplesIntoExamplesBody('User: x\nAgent: y', {
      agentUseCasesJson: JSON.stringify([
        {
          id: 'u',
          label: 'B',
          parent_id: null,
          sort_order: 0,
          refinement_prompt: '',
          dialogue: [{ turn_id: 't', role: 'assistant', content: 'Z' }],
          notes: { behavior: '', tone: '' },
          bubble_notes: {},
        },
      ]),
    });
    expect(out.startsWith('User: x')).toBe(true);
    expect(out).toContain('---');
    expect(out).toContain('Assistente: Z');
  });
});
