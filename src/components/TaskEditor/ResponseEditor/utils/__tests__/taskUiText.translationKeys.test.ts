import { describe, expect, it } from 'vitest';
import { resolveTranslationKey } from '../taskUiText';

describe('resolveTranslationKey (canonical keys)', () => {
  it('accepts task:uuid', () => {
    const task = {
      parameters: [{ parameterId: 'text', value: 'task:a0000000-0000-4000-8000-000000000001' }],
    };
    expect(resolveTranslationKey(task, 'text')).toBe('task:a0000000-0000-4000-8000-000000000001');
  });

  it('accepts runtime.* keys', () => {
    const task = { parameters: [{ parameterId: 'text', value: 'runtime.x.y.z' }] };
    expect(resolveTranslationKey(task, 'text')).toBe('runtime.x.y.z');
  });

  it('rejects bare UUID', () => {
    const task = {
      parameters: [{ parameterId: 'text', value: 'a0000000-0000-4000-8000-000000000001' }],
    };
    expect(resolveTranslationKey(task, 'text')).toBeNull();
  });
});
