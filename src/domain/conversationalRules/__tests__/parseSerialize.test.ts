import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVERSATIONAL_RULES_LIBRARY } from '../defaultConversationalRulesLibrary';
import {
  materializeConversationalRulesFromLibrary,
  parseAgentConversationalRulesJson,
  serializeConversationalRules,
} from '../parseSerialize';

describe('parseAgentConversationalRulesJson', () => {
  it('materializes library when raw is empty', () => {
    const rules = parseAgentConversationalRulesJson('');
    expect(rules).toHaveLength(DEFAULT_CONVERSATIONAL_RULES_LIBRARY.length);
    expect(rules[0]?.label).toBe('Dati mancanti');
    expect(rules[0]?.libraryRuleId).toBe('lib-dati-mancanti');
  });

  it('round-trips serialized rules', () => {
    const seed = materializeConversationalRulesFromLibrary();
    const raw = serializeConversationalRules(seed);
    const parsed = parseAgentConversationalRulesJson(raw);
    expect(parsed.map((r) => r.label)).toEqual(seed.map((r) => r.label));
  });
});
