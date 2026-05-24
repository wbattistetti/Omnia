import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import {
  backendCallTaskFromManualEntry,
  backendCallTaskWireFromTask,
  resolveEphemeralBackendCallTask,
} from './reviewBackendCallTaskWire';

describe('reviewBackendCallTaskWire', () => {
  const entry = {
    id: 'be-1',
    label: 'Book',
    method: 'POST',
    endpointUrl: 'http://localhost:3100/api/runtime/bookfromagenda',
    creationMode: 'import' as const,
    importSpecRevealed: true,
    frozenMeta: {
      lastImportedAt: null,
      specSourceUrl: null,
      contentHash: null,
      importState: 'ok' as const,
    },
    lastStructuralEditAt: '2026-01-01T00:00:00.000Z',
  };

  it('round-trips SEND/RECEIVE through taskWire', () => {
    const task = {
      id: 'be-1',
      type: TaskType.BackendCall,
      label: 'Book',
      endpoint: { url: entry.endpointUrl, method: 'POST', headers: {} },
      inputs: [{ internalName: 'projectId', apiParam: 'projectId', variable: '' }],
      outputs: [{ internalName: 'slotId', apiField: 'slotId', variable: '' }],
      backendCallSpecMeta: { schemaVersion: 1, importState: 'ok' },
    };
    const wire = backendCallTaskWireFromTask(task);
    expect(wire?.inputs).toHaveLength(1);
    const hydrated = backendCallTaskFromManualEntry(entry, wire);
    expect((hydrated as { inputs?: unknown[] }).inputs).toHaveLength(1);
    expect((hydrated as { outputs?: unknown[] }).outputs).toHaveLength(1);
  });

  it('prefers live task over snapshot wire when richer', () => {
    const wire = {
      inputs: [{ internalName: 'a', apiParam: 'a', variable: '' }],
      outputs: [],
    };
    const live = {
      id: 'be-1',
      type: TaskType.BackendCall,
      label: 'Book',
      inputs: [
        { internalName: 'a', apiParam: 'a', variable: '' },
        { internalName: 'b', apiParam: 'b', variable: '' },
      ],
      outputs: [{ internalName: 'c', apiField: 'c', variable: '' }],
    };
    const resolved = resolveEphemeralBackendCallTask(entry, wire, live);
    expect((resolved as { inputs?: unknown[] }).inputs).toHaveLength(2);
    expect((resolved as { outputs?: unknown[] }).outputs).toHaveLength(1);
  });
});
