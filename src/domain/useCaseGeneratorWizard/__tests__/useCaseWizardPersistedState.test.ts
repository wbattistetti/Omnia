import { describe, expect, it } from 'vitest';
import {
  parseUseCaseWizardPersistedState,
  serializeUseCaseWizardPersistedState,
} from '../useCaseWizardPersistedState';

describe('parseUseCaseWizardPersistedState', () => {
  it('parses V1 with baselines', () => {
    const v = {
      schemaVersion: 1,
      enabled: true,
      stepIndex: 2,
      unlockedMaxStepIndex: 3,
      useCaseListBaseline: '[{"id":"a"}]',
      examplePhraseBaselineById: { a: 'hello' },
    };
    const raw = JSON.stringify(v);
    const p = parseUseCaseWizardPersistedState(raw);
    expect(p?.stepIndex).toBe(2);
    expect(p?.useCaseListBaseline).toBe('[{"id":"a"}]');
    expect(p?.examplePhraseBaselineById?.a).toBe('hello');
  });

  it('parses legacy sessionStorage shape without schemaVersion', () => {
    const raw = JSON.stringify({ enabled: false, stepIndex: 1, unlockedMaxStepIndex: 2 });
    const p = parseUseCaseWizardPersistedState(raw);
    expect(p?.schemaVersion).toBe(1);
    expect(p?.stepIndex).toBe(1);
    expect(p?.unlockedMaxStepIndex).toBe(2);
    expect(p?.enabled).toBe(false);
  });

  it('round-trip serialize', () => {
    const v = {
      schemaVersion: 1 as const,
      enabled: true,
      stepIndex: 0,
      unlockedMaxStepIndex: 1,
      useCaseListBaseline: 'x',
    };
    const s = serializeUseCaseWizardPersistedState(v);
    const p = parseUseCaseWizardPersistedState(s);
    expect(p?.useCaseListBaseline).toBe('x');
  });
});
