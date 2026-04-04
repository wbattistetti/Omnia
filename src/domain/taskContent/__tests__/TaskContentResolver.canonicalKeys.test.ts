import { describe, it, expect } from 'vitest';
import { TaskContentResolver } from '../TaskContentResolver';
import { makeTranslationKey } from '../../../utils/translationKeys';

describe('TaskContentResolver canonical task:uuid keys', () => {
  it('resolves message text when parameter stores task:<guid>', () => {
    const guid = 'a0a0a0a0-a0a0-40a0-a0a0-a0a0a0a0a0a0';
    const taskId = guid;
    const key = makeTranslationKey('task', guid);
    const resolver = TaskContentResolver.create({
      getTranslations: () => ({ [key]: 'Hello canonical' }),
      getTask: () =>
        ({
          parameters: [{ parameterId: 'text', value: key }],
        }) as any,
    });
    const r = resolver.getMessageText(taskId);
    expect(r.hasContent).toBe(true);
    expect(r.text).toBe('Hello canonical');
    expect(r.textKey).toBe(key);
  });

  it('does not treat bare GUID as a translation store key', () => {
    const guid = 'b1b1b1b1-b1b1-41b1-b1b1-b1b1b1b1b1b1';
    const resolver = TaskContentResolver.create({
      getTranslations: () => ({ [`task:${guid}`]: 'Should not use bare guid' }),
      getTask: () =>
        ({
          parameters: [{ parameterId: 'text', value: guid }],
        }) as any,
    });
    const r = resolver.getMessageText(guid);
    expect(r.hasContent).toBe(false);
  });
});
