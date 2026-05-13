/**
 * Test isolati per i domain helper del gate di stile **v2 multi-pill**.
 * Coprono validità entry, prima entry invalida, conteggi/listing per styleId,
 * e migrazione lazy dal vecchio campo `agentConversationStyleExample`.
 */

import { describe, it, expect } from 'vitest';
import {
  conversationMatchesStyleId,
  countConversationsByStyleId,
  defaultStyleEntryForRegistryId,
  firstInvalidCheckedStyle,
  hasAnyCheckedStyle,
  isStyleEntryValid,
  listCheckedStyleIds,
  listGeneratedStyleIds,
  migrateLegacyStyleExample,
  type ConversationStyleEntry,
  type ConversationStyleSelections,
} from '../conversationStyleSelections';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/constants';
import type { UseCaseGeneratorWizardConversation } from '@domain/useCaseGeneratorWizard/types';

const KNOWN_ID = AI_AGENT_GLOBAL_USE_CASE_STYLES[0]?.id ?? 'cortese';
const SECOND_ID = AI_AGENT_GLOBAL_USE_CASE_STYLES[1]?.id ?? 'ironico';

function entry(overrides: Partial<ConversationStyleEntry> = {}): ConversationStyleEntry {
  return {
    checked: false,
    description: 'Stile cortese e formale',
    example: 'utente: ciao\nagente: buongiorno',
    ...overrides,
  };
}

describe('defaultStyleEntryForRegistryId', () => {
  it('returns a default entry seeded from registry contract', () => {
    const e = defaultStyleEntryForRegistryId(KNOWN_ID);
    expect(e.checked).toBe(false);
    expect(e.description.length).toBeGreaterThan(0);
    expect(e.example).toBe('');
  });

  it('throws on unknown styleId (fail-loud, no silent default)', () => {
    expect(() => defaultStyleEntryForRegistryId('not-in-registry')).toThrow();
  });
});

describe('isStyleEntryValid', () => {
  it('is invalid when description is empty (always)', () => {
    expect(isStyleEntryValid(entry({ description: '' }), false)).toBe(false);
    expect(isStyleEntryValid(entry({ description: '   ' }), true)).toBe(false);
  });

  it('with auto OFF requires non-empty example', () => {
    expect(isStyleEntryValid(entry({ example: '' }), false)).toBe(false);
    expect(isStyleEntryValid(entry({ example: '\t  \n' }), false)).toBe(false);
    expect(isStyleEntryValid(entry({ example: 'utente: x' }), false)).toBe(true);
  });

  it('with auto ON ignores example', () => {
    expect(isStyleEntryValid(entry({ example: '' }), true)).toBe(true);
  });
});

describe('firstInvalidCheckedStyle', () => {
  it('returns null when no style is checked', () => {
    const sel: ConversationStyleSelections = {
      [KNOWN_ID]: entry({ checked: false }),
    };
    expect(firstInvalidCheckedStyle(sel, false)).toBeNull();
  });

  it('returns null when all checked styles are valid', () => {
    const sel: ConversationStyleSelections = {
      [KNOWN_ID]: entry({ checked: true }),
      [SECOND_ID]: entry({ checked: true }),
    };
    expect(firstInvalidCheckedStyle(sel, false)).toBeNull();
  });

  it('returns the FIRST invalid (registry order, not object key order)', () => {
    const sel: ConversationStyleSelections = {
      [SECOND_ID]: entry({ checked: true, example: '' }),
      [KNOWN_ID]: entry({ checked: true, example: '' }),
    };
    expect(firstInvalidCheckedStyle(sel, false)).toBe(KNOWN_ID);
  });

  it('skips unchecked invalid entries', () => {
    const sel: ConversationStyleSelections = {
      [KNOWN_ID]: entry({ checked: false, example: '' }),
      [SECOND_ID]: entry({ checked: true, description: '' }),
    };
    expect(firstInvalidCheckedStyle(sel, false)).toBe(SECOND_ID);
  });
});

describe('listCheckedStyleIds / hasAnyCheckedStyle', () => {
  it('returns empty when nothing is checked', () => {
    expect(listCheckedStyleIds({})).toEqual([]);
    expect(hasAnyCheckedStyle({})).toBe(false);
  });

  it('preserves registry order regardless of insertion order', () => {
    const sel: ConversationStyleSelections = {
      [SECOND_ID]: entry({ checked: true }),
      [KNOWN_ID]: entry({ checked: true }),
    };
    const list = listCheckedStyleIds(sel);
    // KNOWN_ID viene prima nel registry (indice 0).
    expect(list[0]).toBe(KNOWN_ID);
    expect(list[1]).toBe(SECOND_ID);
    expect(hasAnyCheckedStyle(sel)).toBe(true);
  });
});

describe('listGeneratedStyleIds / countConversationsByStyleId', () => {
  function conv(styleId: string | undefined, conversationId = `c-${Math.random()}`): UseCaseGeneratorWizardConversation {
    return {
      conversationId,
      turns: [],
      outcome: 'positive',
      ...(styleId ? { styleId } : {}),
    } as UseCaseGeneratorWizardConversation;
  }

  it('returns empty list for empty input', () => {
    expect(listGeneratedStyleIds([])).toEqual([]);
    expect(countConversationsByStyleId([])).toEqual({});
  });

  it('orders known styleIds by registry and maps legacy conversations to the default style', () => {
    const out = listGeneratedStyleIds([
      conv(SECOND_ID),
      conv(undefined),
      conv(KNOWN_ID),
      conv(KNOWN_ID),
    ]);
    expect(out[0]).toBe(KNOWN_ID);
    expect(out[1]).toBe(SECOND_ID);
    expect(out).not.toContain('__legacy__');
  });

  it('counts legacy conversations under the default style', () => {
    const counts = countConversationsByStyleId([
      conv(KNOWN_ID),
      conv(KNOWN_ID),
      conv(undefined),
    ]);
    const expectedDefaultCount = KNOWN_ID === DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID ? 3 : 1;
    expect(counts[DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID]).toBe(expectedDefaultCount);
    expect(counts.__legacy__).toBeUndefined();
  });
});

describe('conversationMatchesStyleId', () => {
  function conv(styleId: string | undefined): UseCaseGeneratorWizardConversation {
    return {
      conversationId: 'cid',
      turns: [],
      outcome: 'positive',
      ...(styleId ? { styleId } : {}),
    } as UseCaseGeneratorWizardConversation;
  }

  it('matcha lo styleId esatto', () => {
    expect(conversationMatchesStyleId(conv(KNOWN_ID), KNOWN_ID)).toBe(true);
    expect(conversationMatchesStyleId(conv(KNOWN_ID), SECOND_ID)).toBe(false);
  });

  it('le conversazioni legacy senza styleId matchano lo stile DEFAULT (coerenza con counters)', () => {
    expect(conversationMatchesStyleId(conv(undefined), DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID)).toBe(true);
  });

  it('le conversazioni legacy NON matchano stili diversi dal default', () => {
    const otherId =
      AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id !== DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID)
        ?.id ?? 'ironico';
    expect(conversationMatchesStyleId(conv(undefined), otherId)).toBe(false);
  });

  it('styleId vuoto è trattato come legacy', () => {
    expect(conversationMatchesStyleId(conv(''), DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID)).toBe(true);
  });
});

describe('migrateLegacyStyleExample', () => {
  it('returns existing selections unchanged (no overwrite)', () => {
    const sel: ConversationStyleSelections = { [KNOWN_ID]: entry({ checked: true }) };
    const out = migrateLegacyStyleExample(sel, 'legacy text');
    expect(out).toBe(sel);
  });

  it('returns empty selections if legacy is empty/whitespace', () => {
    expect(migrateLegacyStyleExample(undefined, '')).toEqual({});
    expect(migrateLegacyStyleExample(undefined, '   \n')).toEqual({});
    expect(migrateLegacyStyleExample(undefined, null)).toEqual({});
  });

  it('seeds default style as checked with the legacy example as `example`', () => {
    const out = migrateLegacyStyleExample(undefined, 'utente: testo legacy');
    const seedId = DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
    expect(out[seedId]).toBeDefined();
    expect(out[seedId].checked).toBe(true);
    expect(out[seedId].example).toBe('utente: testo legacy');
    expect(out[seedId].description.length).toBeGreaterThan(0);
  });
});
