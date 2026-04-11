import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VariableInstance } from '@types/variableTypes';
import {
  collectCompileTextChunksFromTaskJson,
  computeReferenceScanInternalTextForTask,
  resolveVariableLabelsToInternalReferenceText,
} from '../referenceScanCompile';
import { REFERENCE_SCAN_INTERNAL_TEXT_KEY } from '../internalReferenceHaystack';
import { makeTranslationKey } from '@utils/translationKeys';
import { setProjectTranslationsRegistry } from '@utils/projectTranslationsRegistry';

describe('referenceScanCompile', () => {
  const guidNome = '11111111-1111-4111-8111-111111111111';
  const guidEta = '22222222-2222-4222-8222-222222222222';

  const varsNomeEta: VariableInstance[] = [
    { id: guidNome, taskInstanceId: 't', dataPath: 'p' },
    { id: guidEta, taskInstanceId: 't', dataPath: 'p' },
  ];

  beforeEach(() => {
    setProjectTranslationsRegistry({
      [makeTranslationKey('var', guidNome)]: 'nome',
      [makeTranslationKey('var', guidEta)]: 'eta',
    });
  });

  it('resolveVariableLabelsToInternalReferenceText maps {{label}} and [label]', () => {
    expect(resolveVariableLabelsToInternalReferenceText('Hello {{nome}}!', varsNomeEta)).toContain(
      `{{${guidNome}}}`
    );
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveVariableLabelsToInternalReferenceText('[eta] > 0', varsNomeEta)).toContain(`[${guidEta}]`);
    } finally {
      spy.mockRestore();
    }
  });

  it('collectCompileTextChunksFromTaskJson ignores referenceScanInternalText key in walk', () => {
    const chunks = collectCompileTextChunksFromTaskJson(
      {
        [REFERENCE_SCAN_INTERNAL_TEXT_KEY]: 'skip-me',
        body: 'x {{nome}}',
      },
      varsNomeEta
    );
    expect(chunks.join('\n')).not.toContain('skip-me');
    expect(chunks.join('\n')).toContain(guidNome);
  });

  it('computeReferenceScanInternalTextForTask joins compile chunks', () => {
    const text = computeReferenceScanInternalTextForTask({ foo: '{{nome}}' }, varsNomeEta);
    expect(text).toContain(guidNome);
  });
});
