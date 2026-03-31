/**
 * Tests for compilation error enrichment (fixTarget from backend fields).
 */

import { describe, expect, it } from 'vitest';
import { enrichCompilationError } from '../enrichCompilationError';

describe('enrichCompilationError', () => {
  it('maps EmptyEscalation + stepKey + escalationIndex to taskEscalation fixTarget', () => {
    const e = enrichCompilationError({
      category: 'EmptyEscalation',
      taskId: 'task-guid-1',
      nodeId: 'node-1',
      rowId: 'row-1',
      message: 'Dialogue escalation has no actions.',
      severity: 'Error',
      stepKey: 'noMatch',
      escalationIndex: 1,
    });
    expect(e.category).toBe('EmptyEscalation');
    expect(e.fixTarget).toEqual({
      type: 'taskEscalation',
      taskId: 'task-guid-1',
      stepKey: 'noMatch',
      escalationIndex: 1,
    });
    expect(e.stepKey).toBe('noMatch');
    expect(e.escalationIndex).toBe(1);
  });

  it('defaults escalation index to 0 when missing', () => {
    const e = enrichCompilationError({
      category: 'EmptyEscalation',
      taskId: 't1',
      stepKey: 'start',
      message: 'x',
      severity: 'Error',
    });
    expect(e.fixTarget).toEqual({
      type: 'taskEscalation',
      taskId: 't1',
      stepKey: 'start',
      escalationIndex: 0,
    });
  });
});
