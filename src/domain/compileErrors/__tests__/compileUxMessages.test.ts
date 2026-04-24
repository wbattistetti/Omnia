import { describe, expect, it } from 'vitest';
import type { CompilationError } from '@components/FlowCompiler/types';
import { isCompileErrorReportUxCode, resolveCompileUxMessage } from '../compileUxMessages';

function e(p: Partial<CompilationError> & Pick<CompilationError, 'taskId' | 'message' | 'severity'>): CompilationError {
  return { ...p, fixTarget: p.fixTarget ?? { type: 'task', taskId: p.taskId } } as CompilationError;
}

describe('compileUxMessages', () => {
  it('isCompileErrorReportUxCode matches designer-visible codes', () => {
    expect(isCompileErrorReportUxCode('ParserMissing')).toBe(true);
    expect(isCompileErrorReportUxCode('SubflowChildNotRunnable')).toBe(true);
    expect(isCompileErrorReportUxCode('TaskDataInvalid')).toBe(false);
  });

  it('resolveCompileUxMessage returns null for unknown code', () => {
    expect(resolveCompileUxMessage(e({ taskId: 't', message: '', severity: 'error', code: 'TaskDataInvalid' }))).toBeNull();
  });

  it('resolveCompileUxMessage passes through IaProvisionProviderError message', () => {
    expect(
      resolveCompileUxMessage(
        e({
          taskId: 't',
          message: 'Non-english Agents must use turbo.',
          severity: 'error',
          code: 'IaProvisionProviderError',
        })
      )
    ).toBe('Non-english Agents must use turbo.');
    expect(isCompileErrorReportUxCode('IaProvisionProviderError')).toBe(true);
  });
});
