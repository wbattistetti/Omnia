import { describe, expect, it } from 'vitest';
import { flushAiAgentEditorsBeforeProjectSave, registerAiAgentProjectSaveFlush } from './aiAgentProjectSaveFlush';

describe('aiAgentProjectSaveFlush', () => {
  it('invokes registered flush callbacks', () => {
    const calls: number[] = [];
    const unregister = registerAiAgentProjectSaveFlush(() => {
      calls.push(1);
    });
    flushAiAgentEditorsBeforeProjectSave();
    expect(calls).toEqual([1]);
    unregister();
  });

  it('does not invoke flush after unregister', () => {
    let n = 0;
    const unregister = registerAiAgentProjectSaveFlush(() => {
      n += 1;
    });
    unregister();
    flushAiAgentEditorsBeforeProjectSave();
    expect(n).toBe(0);
  });
});
