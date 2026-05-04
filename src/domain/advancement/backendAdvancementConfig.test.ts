import { describe, expect, it } from 'vitest';
import { isAdvancementNlScriptOutOfSync } from './backendAdvancementConfig';

describe('isAdvancementNlScriptOutOfSync', () => {
  const base = { enabled: true, dslExpression: '1', naturalLanguage: 'a' };

  it('false quando non cè script', () => {
    expect(
      isAdvancementNlScriptOutOfSync({ ...base, dslExpression: '  ', naturalLanguageAlignedWithScript: 'a' })
    ).toBe(false);
  });

  it('false su task senza allineamento IA (legacy)', () => {
    expect(isAdvancementNlScriptOutOfSync({ ...base, naturalLanguage: 'x' })).toBe(false);
  });

  it('true quando la descrizione non coincide con ultimo align IA', () => {
    expect(
      isAdvancementNlScriptOutOfSync({
        ...base,
        naturalLanguage: 'modificato',
        naturalLanguageAlignedWithScript: 'originale',
      })
    ).toBe(true);
  });

  it('true dopo edit manuale Monaco', () => {
    expect(
      isAdvancementNlScriptOutOfSync({
        ...base,
        naturalLanguageAlignedWithScript: 'a',
        dslManuallyEditedAfterAlign: true,
      })
    ).toBe(true);
  });

  it('false quando NL coincide con align', () => {
    expect(
      isAdvancementNlScriptOutOfSync({
        ...base,
        naturalLanguage: ' stesso ',
        naturalLanguageAlignedWithScript: 'stesso',
      })
    ).toBe(false);
  });
});
