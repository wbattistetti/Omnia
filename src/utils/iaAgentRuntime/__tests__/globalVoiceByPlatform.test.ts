/**
 * Tests for the platform-keyed default voice persistence.
 *
 * Coverage:
 *  - load returns empty map when storage is empty / corrupt
 *  - save then load roundtrip per platform (without overwriting other platforms)
 *  - save with `null` removes the entry
 *  - malformed payloads (missing `id` / `language`, unknown platform keys) are rejected
 *  - describeVoice prefers `settings.name` and falls back to `id`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_PLATFORM_DISPLAY_LABEL,
  SUPPORTED_AGENT_PLATFORMS,
  describeVoice,
  getGlobalVoiceFor,
  loadGlobalVoiceByPlatform,
  resolveVoiceForPlatform,
  resolveVoicesByPlatform,
  saveGlobalVoiceForPlatform,
} from '../globalVoiceByPlatform';
import type { IAAgentVoiceConfig } from 'types/iaAgentRuntimeSetup';

const STORAGE_KEY = 'omnia.globalVoiceByPlatform.v1';

/**
 * Il setup globale di Vitest stubba `localStorage` con `vi.fn()` (no-op): i test non
 * persistono nulla. Per testare il roundtrip dello storage, ribindiamo `localStorage`
 * a un backing `Map` per il file. Pattern usato anche in `devTunnelCompileBridge.test.ts`.
 */
beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeVoice(overrides: Partial<IAAgentVoiceConfig> = {}): IAAgentVoiceConfig {
  return {
    id: 'voice-1',
    language: 'it',
    ...overrides,
  };
}

describe('SUPPORTED_AGENT_PLATFORMS / display labels', () => {
  it('lists the four real platforms in alphabetical order (custom is excluded by the dropdown)', () => {
    expect(SUPPORTED_AGENT_PLATFORMS).toEqual(['anthropic', 'elevenlabs', 'google', 'openai']);
  });

  it('renders "google" as "Gemini" (commercial label, not technical)', () => {
    expect(AGENT_PLATFORM_DISPLAY_LABEL.google).toBe('Gemini');
  });
});

describe('loadGlobalVoiceByPlatform', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(loadGlobalVoiceByPlatform()).toEqual({});
  });

  it('returns an empty map when JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');
    expect(loadGlobalVoiceByPlatform()).toEqual({});
  });

  it('ignores unknown platform keys but keeps valid entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        elevenlabs: { id: 'v-1', language: 'it' },
        atlantis: { id: 'fake', language: 'xx' }, // unknown platform → dropped
      })
    );
    const map = loadGlobalVoiceByPlatform();
    expect(map.elevenlabs).toEqual({ id: 'v-1', language: 'it' });
    expect((map as Record<string, unknown>).atlantis).toBeUndefined();
  });

  it('drops malformed voice payloads (missing id or language)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        elevenlabs: { id: 'v-1', language: 'it' },
        openai: { id: '', language: 'en' }, // empty id
        anthropic: { language: 'en' }, // missing id
        google: { id: 'g-1' }, // missing language
      })
    );
    const map = loadGlobalVoiceByPlatform();
    expect(Object.keys(map).sort()).toEqual(['elevenlabs']);
  });
});

describe('saveGlobalVoiceForPlatform', () => {
  it('persists per-platform without overwriting other platforms', () => {
    saveGlobalVoiceForPlatform('elevenlabs', makeVoice({ id: 'simon' }));
    saveGlobalVoiceForPlatform('openai', makeVoice({ id: 'alloy', language: 'en' }));

    const map = loadGlobalVoiceByPlatform();
    expect(map.elevenlabs).toEqual({ id: 'simon', language: 'it' });
    expect(map.openai).toEqual({ id: 'alloy', language: 'en' });
  });

  it('removes the entry when called with null (does not touch other platforms)', () => {
    saveGlobalVoiceForPlatform('elevenlabs', makeVoice({ id: 'simon' }));
    saveGlobalVoiceForPlatform('openai', makeVoice({ id: 'alloy' }));
    saveGlobalVoiceForPlatform('elevenlabs', null);

    const map = loadGlobalVoiceByPlatform();
    expect(map.elevenlabs).toBeUndefined();
    expect(map.openai).toEqual({ id: 'alloy', language: 'it' });
  });

  it('throws when the voice payload is malformed (fail-loud, no silent swallow)', () => {
    expect(() =>
      saveGlobalVoiceForPlatform('elevenlabs', { id: '', language: 'it' } as IAAgentVoiceConfig)
    ).toThrow(/voice malformata/);
  });
});

describe('getGlobalVoiceFor', () => {
  it('returns null when not configured (no fallback to other platforms)', () => {
    saveGlobalVoiceForPlatform('elevenlabs', makeVoice({ id: 'simon' }));
    expect(getGlobalVoiceFor('openai')).toBeNull();
  });

  it('returns the saved voice for the requested platform', () => {
    saveGlobalVoiceForPlatform('elevenlabs', makeVoice({ id: 'simon' }));
    expect(getGlobalVoiceFor('elevenlabs')).toEqual({ id: 'simon', language: 'it' });
  });
});

describe('resolveVoiceForPlatform', () => {
  /**
   * Specifica esplicita di B1/C1: la voce mostrata nel deploy menu segue la priorità
   * (1) configurazione GENERALE (mappa platform→voce) → (2) override del task editor
   * SE la sua `platform` coincide con quella richiesta → (3) `null` («Manca la voce»).
   * L'override del task gestisce una sola platform alla volta, quindi può "contribuire"
   * voci solo per quella platform.
   */
  const globalVoice = makeVoice({ id: 'global-simon' });
  const overrideVoice = makeVoice({ id: 'task-jane', language: 'en' });

  it('priorità (1): se la mappa GLOBALE ha una voce per la platform, vince', () => {
    const map = { elevenlabs: globalVoice };
    const taskOverride = { platform: 'elevenlabs' as const, voice: overrideVoice };
    expect(resolveVoiceForPlatform('elevenlabs', map, taskOverride)).toEqual(globalVoice);
  });

  it('priorità (2): se la GLOBALE è vuota e l\u2019override del task è sulla stessa platform, usa la voce dell\u2019override', () => {
    const taskOverride = { platform: 'openai' as const, voice: overrideVoice };
    expect(resolveVoiceForPlatform('openai', {}, taskOverride)).toEqual(overrideVoice);
  });

  it('NON ricade sull\u2019override se la sua platform è diversa da quella richiesta', () => {
    const taskOverride = { platform: 'elevenlabs' as const, voice: overrideVoice };
    expect(resolveVoiceForPlatform('openai', {}, taskOverride)).toBeNull();
  });

  it('ritorna null quando GLOBALE assente e override mancante', () => {
    expect(resolveVoiceForPlatform('anthropic', {}, null)).toBeNull();
    expect(resolveVoiceForPlatform('anthropic', {}, undefined)).toBeNull();
  });

  it('ritorna null se la voce nell\u2019override è malformata (id vuoto)', () => {
    const bad = { platform: 'openai' as const, voice: { id: '', language: 'en' } as IAAgentVoiceConfig };
    expect(resolveVoiceForPlatform('openai', {}, bad)).toBeNull();
  });
});

describe('resolveVoicesByPlatform', () => {
  it('compone la mappa risolta per tutte le piattaforme supportate', () => {
    const map = { elevenlabs: makeVoice({ id: 'el-1' }), openai: makeVoice({ id: 'oa-1' }) };
    const taskOverride = { platform: 'anthropic' as const, voice: makeVoice({ id: 'ant-task' }) };
    const out = resolveVoicesByPlatform(map, taskOverride);
    expect(out.elevenlabs).toEqual({ id: 'el-1', language: 'it' });
    expect(out.openai).toEqual({ id: 'oa-1', language: 'it' });
    expect(out.anthropic).toEqual({ id: 'ant-task', language: 'it' });
    expect(out.google).toBeUndefined();
  });

  it('è pura: non scrive in localStorage', () => {
    const before = JSON.stringify(loadGlobalVoiceByPlatform());
    resolveVoicesByPlatform({ elevenlabs: makeVoice({ id: 'x' }) }, null);
    const after = JSON.stringify(loadGlobalVoiceByPlatform());
    expect(after).toBe(before);
  });
});

describe('describeVoice', () => {
  it('prefers settings.name when present and non-empty', () => {
    const voice: IAAgentVoiceConfig = {
      id: 'voice_id_xyz',
      language: 'it',
      settings: { name: 'Simon' },
    };
    expect(describeVoice(voice)).toBe('Simon');
  });

  it('falls back to the raw id when settings.name is missing or blank', () => {
    expect(describeVoice({ id: 'voice_id_xyz', language: 'it' })).toBe('voice_id_xyz');
    expect(describeVoice({ id: 'voice_id_xyz', language: 'it', settings: { name: '   ' } })).toBe(
      'voice_id_xyz'
    );
  });
});
