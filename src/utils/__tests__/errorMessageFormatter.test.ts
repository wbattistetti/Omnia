import { describe, expect, it } from 'vitest';
import type { CompilationError } from '../../components/FlowCompiler/types';
import {
  formatCompilationErrorChatBubble,
  formatCompilationErrorMessage,
} from '../errorMessageFormatter';

function err(partial: Partial<CompilationError> & Pick<CompilationError, 'taskId' | 'fixTarget'>): CompilationError {
  return {
    severity: 'error',
    message: '',
    ...partial,
  } as CompilationError;
}

describe('formatCompilationErrorChatBubble', () => {
  it('wraps a single error with intro line', () => {
    const text = formatCompilationErrorChatBubble(
      err({
        taskId: 'a',
        fixTarget: { type: 'task', taskId: 'a' },
        message: 'Primo problema',
      }),
      0,
      1
    );
    expect(text).toContain('non può partire');
    expect(text).toContain('Primo problema');
    expect(text).not.toContain('Errore 1 di');
  });

  it('labels index when multiple errors', () => {
    const text = formatCompilationErrorChatBubble(
      err({
        taskId: 'b',
        fixTarget: { type: 'task', taskId: 'b' },
        message: 'Secondo',
      }),
      1,
      3
    );
    expect(text).toContain('Errore 2 di 3');
    expect(text).toContain('Secondo');
  });
});

describe('formatCompilationErrorMessage', () => {
  it('includes unique error messages as bullets', () => {
    const text = formatCompilationErrorMessage([
      err({
        taskId: 'a',
        fixTarget: { type: 'task', taskId: 'a' },
        message: 'Primo problema',
      }),
      err({
        taskId: 'b',
        fixTarget: { type: 'task', taskId: 'b' },
        message: 'Secondo problema',
      }),
    ]);
    expect(text).toContain('ci sono 2 errori');
    expect(text).toContain('• Primo problema');
    expect(text).toContain('• Secondo problema');
  });

  it('deduplicates identical messages', () => {
    const text = formatCompilationErrorMessage([
      err({ taskId: 'a', fixTarget: { type: 'task', taskId: 'a' }, message: 'Stesso' }),
      err({ taskId: 'b', fixTarget: { type: 'task', taskId: 'b' }, message: 'Stesso' }),
    ]);
    expect(text).toContain('ci sono 2 errori');
    expect(text.match(/• Stesso/g)?.length).toBe(1);
  });

  it('singular headline for one error', () => {
    const text = formatCompilationErrorMessage([
      err({ taskId: 'a', fixTarget: { type: 'task', taskId: 'a' }, message: 'Solo uno' }),
    ]);
    expect(text).toContain('c’è 1 errore');
  });

  it('falls back to code when message empty', () => {
    const text = formatCompilationErrorMessage([
      err({ taskId: 'a', fixTarget: { type: 'task', taskId: 'a' }, message: '', code: 'SomeCode' }),
    ]);
    expect(text).toContain('• SomeCode');
  });

  it('keeps distinct IaConvaiBackendCallSendIncomplete lines as separate bullets', () => {
    const text = formatCompilationErrorMessage([
      err({
        taskId: 'bk',
        fixTarget: { type: 'task', taskId: 'bk' },
        code: 'IaConvaiBackendCallSendIncomplete',
        message: 'I parametri SEND del Backend «A» non sono completamente valorizzati.',
      }),
      err({
        taskId: 'bk2',
        fixTarget: { type: 'task', taskId: 'bk2' },
        code: 'IaConvaiBackendCallSendIncomplete',
        message: 'I parametri SEND del Backend «B» non sono completamente valorizzati.',
      }),
    ]);
    expect(text).toContain('ci sono 2 errori');
    expect(text).toContain('• I parametri SEND del Backend «A»');
    expect(text).toContain('• I parametri SEND del Backend «B»');
  });
});
