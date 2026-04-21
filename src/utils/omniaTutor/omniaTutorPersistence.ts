/**
 * Load/save Omnia Tutor (designer LLM) settings in localStorage.
 */

import type { OmniaTutorConfig } from 'types/omniaTutorTypes';
import { AI_PROVIDERS, type AIProvider } from '@context/AIProviderContext';

const STORAGE_KEY = 'omnia.omniaTutor.v1';

function createDefaultOmniaTutorConfig(): OmniaTutorConfig {
  return {
    model: AI_PROVIDERS.groq.defaultModel,
    temperature: 0.3,
    maxTokens: 8192,
    reasoning: 'medium',
    safety: {},
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Validated read; on failure returns defaults and may migrate from legacy `omnia.aiModel` / `omnia.aiProvider`.
 */
export function loadOmniaTutorConfig(): OmniaTutorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (!isRecord(p)) return createDefaultOmniaTutorConfig();
      const model = typeof p.model === 'string' && p.model ? p.model : createDefaultOmniaTutorConfig().model;
      const temperature =
        typeof p.temperature === 'number' && !Number.isNaN(p.temperature) ? p.temperature : 0.3;
      const maxTokens =
        typeof p.maxTokens === 'number' && p.maxTokens > 0
          ? Math.floor(p.maxTokens)
          : createDefaultOmniaTutorConfig().maxTokens;
      const allowed: OmniaTutorConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];
      const reasoning = allowed.includes(p.reasoning as OmniaTutorConfig['reasoning'])
        ? (p.reasoning as OmniaTutorConfig['reasoning'])
        : 'medium';
      const safety = p.safety && isRecord(p.safety) ? { ...p.safety } : {};
      return { model, temperature, maxTokens, reasoning, safety };
    }
  } catch {
    // fall through to migration
  }
  return migrateFromLegacyProvider();
}

function migrateFromLegacyProvider(): OmniaTutorConfig {
  const d = createDefaultOmniaTutorConfig();
  try {
    const prov = localStorage.getItem('omnia.aiProvider') as AIProvider | null;
    const m = localStorage.getItem('omnia.aiModel');
    if (m && (prov === 'groq' || prov === 'openai')) {
      return { ...d, model: m };
    }
  } catch {
    // ignore
  }
  return d;
}

export function saveOmniaTutorConfig(config: OmniaTutorConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    throw new Error('Failed to persist Omnia Tutor config to localStorage');
  }
}

export { createDefaultOmniaTutorConfig as getOmniaTutorDefaultConfig };
