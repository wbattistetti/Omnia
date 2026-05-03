/**
 * Validazione compile: ogni riga SEND deve avere campo API e binding costante|variabile.
 */

import { describe, expect, it } from 'vitest';
import { TaskType, type Task } from '../../../types/taskTypes';
import {
  collectBackendCallIncompleteSendMessages,
  listIncompleteBackendSendWireKeys,
} from '../collectBackendCallIncompleteSendMessages';

describe('collectBackendCallIncompleteSendMessages', () => {
  it('returns empty when no inputs', () => {
    const t = { type: TaskType.BackendCall, inputs: [] } as unknown as Task;
    expect(collectBackendCallIncompleteSendMessages(t)).toEqual([]);
  });

  it('flags missing api and binding', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [{ internalName: 'days', apiParam: '', variable: '' }],
    } as unknown as Task;
    const msgs = collectBackendCallIncompleteSendMessages(t);
    expect(msgs.some((m) => m.includes('days'))).toBe(true);
  });

  it('flags missing binding only when api set', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [{ internalName: 'days', apiParam: 'days', variable: '' }],
    } as unknown as Task;
    expect(collectBackendCallIncompleteSendMessages(t).length).toBeGreaterThan(0);
  });

  it('passes when api and variable set', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [{ internalName: 'days', apiParam: 'days', variable: '3' }],
    } as unknown as Task;
    expect(collectBackendCallIncompleteSendMessages(t)).toEqual([]);
  });

  it('listIncompleteBackendSendWireKeys returns internal names missing binding', () => {
    const t = {
      type: TaskType.BackendCall,
      inputs: [
        { internalName: 'a', apiParam: 'a', variable: 'x' },
        { internalName: 'b', apiParam: '', variable: '' },
        { internalName: 'c', apiParam: 'c', variable: '' },
      ],
    } as unknown as Task;
    expect(listIncompleteBackendSendWireKeys(t).sort()).toEqual(['b', 'c'].sort());
  });
});
