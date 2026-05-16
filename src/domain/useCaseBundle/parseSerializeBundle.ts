/**
 * Parse e serializzazione del wrapper `agentUseCasesJson` v1 (array) / v2 (oggetto versionato).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { parseAgentUseCasesJsonLegacyArray } from '@types/aiAgentUseCases';
import { USE_CASE_BUNDLE_SCHEMA_VERSION, type UseCaseBundleV2Wrapper } from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';
import { ensureUseCaseResponse } from '../aiAgentUseCase/useCaseResponseTasks';

export function isUseCaseBundleV2Wrapper(value: unknown): value is UseCaseBundleV2Wrapper {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return o.useCaseBundleSchemaVersion === USE_CASE_BUNDLE_SCHEMA_VERSION && Array.isArray(o.use_cases);
}

/**
 * Parse `agentUseCasesJson` grezzo → use case normalizzati (sempre con `phrases` dopo migrate).
 */
export function parseAgentUseCaseBundleJson(raw: string | undefined): AIAgentUseCase[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    let list: AIAgentUseCase[];
    if (Array.isArray(parsed)) {
      list = parseAgentUseCasesJsonLegacyArray(parsed);
    } else if (isUseCaseBundleV2Wrapper(parsed)) {
      list = parseAgentUseCasesJsonLegacyArray(parsed.use_cases);
    } else {
      return [];
    }
    return list.map((uc) => ensureUseCaseResponse(ensureUseCasePhrases(uc)));
  } catch {
    return [];
  }
}

/**
 * Serializza il bundle in formato v2 ufficiale.
 */
export function serializeAgentUseCaseBundle(useCases: readonly AIAgentUseCase[]): string {
  const wrapper: UseCaseBundleV2Wrapper = {
    useCaseBundleSchemaVersion: USE_CASE_BUNDLE_SCHEMA_VERSION,
    use_cases: useCases.map((uc) => ensureUseCasePhrases(uc)),
  };
  return JSON.stringify(wrapper);
}

export function getBundleSchemaVersionFromRaw(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return 1;
    if (isUseCaseBundleV2Wrapper(parsed)) return USE_CASE_BUNDLE_SCHEMA_VERSION;
    return null;
  } catch {
    return null;
  }
}
