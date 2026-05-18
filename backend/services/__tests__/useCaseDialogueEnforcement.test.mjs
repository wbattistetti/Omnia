import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coalesceRawUseCaseDialogue,
  coalesceRawUseCasesDialogue,
  getRawUseCaseAssistantContent,
  useCasesMissingAssistantContent,
  buildDialogueCompleteRetryDirective,
} from '../useCaseDialogueEnforcement.js';

describe('useCaseDialogueEnforcement', () => {
  it('coalesces assistant_message alt key into dialogue', () => {
    const raw = {
      id: 'uc1',
      label: 'Test',
      assistant_message: 'Buongiorno, come posso aiutarla?',
    };
    const next = coalesceRawUseCaseDialogue(raw);
    assert.equal(getRawUseCaseAssistantContent(next), 'Buongiorno, come posso aiutarla?');
    assert.equal(next.dialogue[0].role, 'assistant');
    assert.ok(next.dialogue[0].content.length > 0);
  });

  it('detects missing assistant content', () => {
    const cases = [
      { id: 'a', dialogue: [{ role: 'assistant', content: 'Ciao' }] },
      { id: 'b', dialogue: [{ role: 'assistant', content: '' }] },
    ];
    const missing = useCasesMissingAssistantContent(coalesceRawUseCasesDialogue(cases));
    assert.equal(missing.length, 1);
    assert.equal(missing[0].id, 'b');
  });

  it('buildDialogueCompleteRetryDirective mentions incomplete rows', () => {
    const suffix = buildDialogueCompleteRetryDirective([
      { id: 'x', label: 'Ingresso' },
    ]);
    assert.ok(suffix.includes('OUTPUT_RETRY'));
    assert.ok(suffix.includes('dialogue'));
    assert.ok(suffix.includes('Ingresso'));
  });
});
