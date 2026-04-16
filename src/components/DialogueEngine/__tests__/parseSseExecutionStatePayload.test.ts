import { describe, expect, it } from 'vitest';
import { parseSseExecutionStatePayload } from '../orchestratorAdapter';

describe('parseSseExecutionStatePayload', () => {
  it('reads camelCase variableStore', () => {
    const s = parseSseExecutionStatePayload({
      variableStore: { a: '1' },
      executedTaskIds: ['t1'],
      currentNodeId: 'n1',
      retrievalState: 'empty',
      currentRowIndex: 0,
    });
    expect(s.variableStore).toEqual({ a: '1' });
    expect(s.currentNodeId).toBe('n1');
  });

  it('reads PascalCase VariableStore from Newtonsoft', () => {
    const s = parseSseExecutionStatePayload({
      VariableStore: { 'guid-here': 'mario' },
      ExecutedTaskIds: ['x'],
      CurrentNodeId: 'node-1',
    });
    expect(s.variableStore).toEqual({ 'guid-here': 'mario' });
    expect(s.currentNodeId).toBe('node-1');
    expect(s.executedTaskIds.has('x')).toBe(true);
  });
});
