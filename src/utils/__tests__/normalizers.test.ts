import { describe, it, expect } from 'vitest';
import { normalizeProjectData } from '../normalizers';
import { TaskType } from '../../types/taskTypes';

describe('normalizeProjectData', () => {
  it('strips mode from task template items and ensures type', () => {
    const pd = {
      taskTemplates: [
        {
          items: [
            { name: 'A', mode: 'DataRequest', type: TaskType.SayMessage },
            { name: 'B' },
          ],
        },
      ],
    };
    const out = normalizeProjectData(pd);
    const items = out.taskTemplates[0].items;
    expect(items[0].mode).toBeUndefined();
    expect(items[0].type).toBe(TaskType.SayMessage);
    expect(items[1].type).toBe(TaskType.UNDEFINED);
  });

  it('initializes backendCatalog when absent', () => {
    const out = normalizeProjectData({});
    expect(out.backendCatalog?.schemaVersion).toBe(1);
    expect(Array.isArray(out.backendCatalog?.manualEntries)).toBe(true);
    expect(Array.isArray(out.backendCatalog?.auditLog)).toBe(true);
  });
});
