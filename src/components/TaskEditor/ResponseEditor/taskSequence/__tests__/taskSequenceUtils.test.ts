import { describe, expect, it } from 'vitest';
import {
  canonicalPaletteTemplateId,
  matchesAllowedTemplateId,
  normalizeIncomingPaletteTask,
  resolveIncomingPaletteTemplateId,
  reorderTasksInList,
} from '../taskSequenceUtils';

describe('matchesAllowedTemplateId', () => {
  it('matches case-insensitively', () => {
    expect(matchesAllowedTemplateId('sendSMS', ['sendsms'])).toBe(true);
    expect(matchesAllowedTemplateId('readFromBackend', ['writeToBackend'])).toBe(false);
  });

  it('accepts factory ids ending with -template', () => {
    expect(
      matchesAllowedTemplateId('readFromBackend-template', ['readFromBackend', 'writeToBackend'])
    ).toBe(true);
  });
});

describe('resolveIncomingPaletteTemplateId', () => {
  it('resolves palette drag envelope from factory template row', () => {
    expect(
      resolveIncomingPaletteTemplateId({
        type: 'TASK_VIEWER',
        task: { id: 'readFromBackend-template', type: 10, label: 'Read From Backend' },
      })
    ).toBe('readFromBackend');
  });

  it('falls back to factory numeric type when id is an instance guid', () => {
    expect(
      resolveIncomingPaletteTemplateId({
        task: {
          id: 'f90bfda0-2534-4c50-a433-626107faaff4',
          type: 10,
        },
      })
    ).toBe('readFromBackend');
  });
});

describe('canonicalPaletteTemplateId', () => {
  it('strips -template suffix', () => {
    expect(canonicalPaletteTemplateId('writeToBackend-template')).toBe('writeToBackend');
  });
});

describe('normalizeIncomingPaletteTask allowlist', () => {
  it('normalizes factory palette drag for readFromBackend', () => {
    const row = normalizeIncomingPaletteTask({
      type: 'TASK_VIEWER',
      task: { id: 'readFromBackend-template', type: 10, label: 'Read From Backend' },
    });
    expect(row.templateId).toBe('readFromBackend');
    expect(
      matchesAllowedTemplateId(row.templateId, [
        'readFromBackend',
        'writeToBackend',
        'sendSMS',
        'escalateToHuman',
        'waitForAgent',
      ])
    ).toBe(true);
  });
});

describe('reorderTasksInList', () => {
  it('moves item before target index', () => {
    expect(reorderTasksInList(['a', 'b', 'c'], 2, 0, 'before')).toEqual(['c', 'a', 'b']);
  });

  it('moves item after target index', () => {
    expect(reorderTasksInList(['a', 'b', 'c'], 0, 1, 'after')).toEqual(['b', 'a', 'c']);
  });
});
