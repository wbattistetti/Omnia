import { describe, expect, it } from 'vitest';
import { buildSendBindingRowFieldsForApiParam } from '../sendBindingRowFields';

describe('buildSendBindingRowFieldsForApiParam', () => {
  it('marks body property optional when not in schema.required', () => {
    const bind = buildSendBindingRowFieldsForApiParam('windowDays', undefined, {
      requestBodyPropertyNames: ['windowDays', 'constraints'],
      requestBodyRequiredPropertyNames: [],
    });
    expect(bind.sendBindingOptional).toBe(true);
  });

  it('keeps body property required when listed in schema.required', () => {
    const bind = buildSendBindingRowFieldsForApiParam('projectId', undefined, {
      requestBodyPropertyNames: ['projectId', 'windowDays'],
      requestBodyRequiredPropertyNames: ['projectId'],
    });
    expect(bind.sendBindingOptional).toBeUndefined();
  });

  it('prefers x-omnia sendBinding optional list', () => {
    const bind = buildSendBindingRowFieldsForApiParam('queryConstraints', {
      optionalApiParams: ['queryConstraints'],
      requireOneOfSets: [],
    });
    expect(bind.sendBindingOptional).toBe(true);
  });

  it('sendBinding parziale + schema senza required → opzionali (es. windowDays, constraints)', () => {
    const ctx = {
      requestBodyPropertyNames: ['windowDays', 'constraints', 'projectId'],
      requestBodyRequiredPropertyNames: [] as string[],
    };
    const rules = {
      optionalApiParams: [] as string[],
      designTimeRequiredApiParams: ['projectId'],
      requireOneOfSets: [],
    };
    expect(buildSendBindingRowFieldsForApiParam('windowDays', rules, ctx).sendBindingOptional).toBe(
      true
    );
    expect(
      buildSendBindingRowFieldsForApiParam('constraints', rules, ctx).sendBindingOptional
    ).toBe(true);
    expect(
      buildSendBindingRowFieldsForApiParam('projectId', rules, ctx).sendBindingDesignTimeRequired
    ).toBe(true);
    expect(buildSendBindingRowFieldsForApiParam('projectId', rules, ctx).sendBindingOptional).toBe(
      undefined
    );
  });
});
