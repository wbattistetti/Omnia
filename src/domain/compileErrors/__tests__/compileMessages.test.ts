import { describe, expect, it } from 'vitest';
import type { CompilationError } from '@components/FlowCompiler/types';
import { normalizeCompilerError, resolveCompilationUserMessage, resolveMessage } from '../compileMessages';

function err(partial: Partial<CompilationError> & Pick<CompilationError, 'taskId' | 'message' | 'severity'>): CompilationError {
  return {
    taskId: partial.taskId,
    message: partial.message,
    severity: partial.severity,
    fixTarget: partial.fixTarget ?? { type: 'task', taskId: partial.taskId },
    category: partial.category,
    code: partial.code,
    detailCode: partial.detailCode,
    rowLabel: partial.rowLabel,
    rowId: partial.rowId,
    stepKey: partial.stepKey,
    escalationIndex: partial.escalationIndex,
  };
}

describe('compileMessages', () => {
  it('normalizeCompilerError prefers payload code', () => {
    const e = err({
      taskId: 't1',
      message: '',
      severity: 'error',
      code: 'TemplateNotFound',
      category: 'TaskCompilationFailed',
    });
    expect(normalizeCompilerError(e).key).toBe('TemplateNotFound');
  });

  it('resolveMessage uses canonical copy for FlowRowNoTask', () => {
    const { key, ctx } = normalizeCompilerError(
      err({ taskId: 't1', message: 'x', severity: 'error', category: 'TaskNotFound', rowLabel: 'X' })
    );
    expect(key).toBe('FlowRowNoTask');
    ctx.rowDisplayLabel = 'Etichetta';
    expect(resolveMessage(key, ctx)).toBe('Per «Etichetta» non è definito il task.');
  });

  it('resolveCompilationUserMessage preserves [flow] prefix', () => {
    const out = resolveCompilationUserMessage(
      err({
        taskId: 't1',
        message: '[sf1] anything',
        severity: 'error',
        category: 'MultipleEntryNodes',
      }),
      {}
    );
    expect(out.startsWith('[sf1]')).toBe(true);
    expect(out).toContain('più nodi di start');
  });
});
