import { describe, expect, it } from 'vitest';
import type { CompilationError } from '@components/FlowCompiler/types';
import { compilationErrorFixKey, compilationErrorFlowId } from '../compilationErrorFix';

function baseErr(p: Partial<CompilationError>): CompilationError {
  return {
    taskId: 'SYSTEM',
    message: 'x',
    severity: 'error',
    fixTarget: { type: 'task', taskId: 't1' },
    ...p,
  } as CompilationError;
}

describe('compilationErrorFix', () => {
  it('compilationErrorFlowId reads [flow] prefix', () => {
    expect(compilationErrorFlowId(baseErr({ message: '[sub1] hello' }))).toBe('sub1');
    expect(compilationErrorFlowId(baseErr({ message: 'no prefix' }))).toBe('main');
  });

  it('compilationErrorFixKey distinguishes edges and tasks', () => {
    expect(
      compilationErrorFixKey(
        baseErr({ fixTarget: { type: 'edge', edgeId: 'e-a' }, edgeId: 'e-a' })
      )
    ).toBe('edge:e-a');
    expect(compilationErrorFixKey(baseErr({ fixTarget: { type: 'task', taskId: 'tid' } }))).toBe(
      'task:tid'
    );
  });
});
