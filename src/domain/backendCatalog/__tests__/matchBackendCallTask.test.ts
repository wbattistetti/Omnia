import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '../../../types/taskTypes';
import {
  findBackendCallTaskForManualCatalogEntry,
  findGraphBackendTaskForManualCatalogEntry,
} from '../matchBackendCallTask';
import type { ManualCatalogEntry } from '../catalogTypes';

const baseManual = (over: Partial<ManualCatalogEntry>): ManualCatalogEntry => ({
  id: 'm1',
  label: 'X',
  method: 'GET',
  endpointUrl: 'http://localhost:3110/slots',
  frozenMeta: {
    lastImportedAt: null,
    specSourceUrl: null,
    contentHash: null,
    importState: 'none',
  },
  lastStructuralEditAt: new Date().toISOString(),
  ...over,
});

function mockBackendTask(id: string, url: string, method: string): Task {
  return {
    id,
    type: TaskType.BackendCall,
    label: 'BC',
    endpoint: { url, method },
  } as Task;
}

describe('findBackendCallTaskForManualCatalogEntry', () => {
  it('matches using canonicalKey (trailing slash)', () => {
    const t = mockBackendTask('a1', 'http://localhost:3110/slots/', 'GET');
    const entry = baseManual({ endpointUrl: 'http://localhost:3110/slots', method: 'GET' });
    expect(findBackendCallTaskForManualCatalogEntry([t], entry)?.id).toBe('a1');
  });

  it('returns null when method differs', () => {
    const t = mockBackendTask('a1', 'http://localhost:3110/slots', 'POST');
    const entry = baseManual({ method: 'GET' });
    expect(findBackendCallTaskForManualCatalogEntry([t], entry)).toBeNull();
  });

  it('returns null when url is empty', () => {
    const t = mockBackendTask('a1', 'http://x/y', 'GET');
    const entry = baseManual({ endpointUrl: '' });
    expect(findBackendCallTaskForManualCatalogEntry([t], entry)).toBeNull();
  });
});

describe('findGraphBackendTaskForManualCatalogEntry', () => {
  it('finds graph task when manual + backend share same catalog row (merge)', () => {
    const graphTask = mockBackendTask('task-graph', 'http://localhost:3110/slots', 'GET');
    const manual = baseManual({
      id: 'man-1',
      endpointUrl: 'http://localhost:3110/slots',
      method: 'GET',
    });
    const found = findGraphBackendTaskForManualCatalogEntry([graphTask], [manual], 'man-1');
    expect(found?.id).toBe('task-graph');
  });

  it('returns null when no Backend Call task matches merged row', () => {
    const manual = baseManual({ id: 'only-manual' });
    expect(findGraphBackendTaskForManualCatalogEntry([], [manual], 'only-manual')).toBeNull();
  });
});
