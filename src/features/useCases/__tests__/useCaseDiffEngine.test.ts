import { describe, expect, it } from 'vitest';
import { diffUseCaseStep } from '../diff/UseCaseDiffEngine';

describe('UseCaseDiffEngine', () => {
  it('marks unchanged fields as not changed', () => {
    const diff = diffUseCaseStep(
      {
        userUtterance: 'hello',
        semanticValue: 'a:1',
        linguisticValue: 'a:uno',
        grammarUsed: { type: 'ask', contract: 'runtime.x' },
        botResponse: 'ok',
      },
      {
        semanticValue: 'a:1',
        linguisticValue: 'a:uno',
        grammarUsed: { type: 'ask', contract: 'runtime.x' },
        botResponse: 'ok',
      }
    );
    expect(diff.changed).toBe(false);
  });

  it('detects field-level differences', () => {
    const diff = diffUseCaseStep(
      {
        userUtterance: 'hello',
        semanticValue: 'a:1',
        linguisticValue: 'a:uno',
        grammarUsed: { type: 'ask', contract: 'runtime.x' },
        botResponse: 'ok',
      },
      {
        semanticValue: 'a:2',
        linguisticValue: 'a:dos',
        grammarUsed: { type: 'confirm', contract: 'runtime.y' },
        botResponse: 'changed',
      }
    );
    expect(diff.changed).toBe(true);
    expect(diff.semanticValue.changed).toBe(true);
    expect(diff.botResponse.changed).toBe(true);
  });
});

