/**
 * Parse e serializzazione del wrapper `agentUseCasesJson` v1 (array) / v2–v3 (oggetto versionato).
 */

import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { parseAgentUseCasesJsonLegacyArray } from '@types/aiAgentUseCases';
import { parseUseCaseCategoriesFromBundle } from '@domain/aiAgentUseCase/useCaseCategories';
import {
  USE_CASE_BUNDLE_SCHEMA_VERSION,
  USE_CASE_BUNDLE_SCHEMA_VERSION_V2,
  type UseCaseBundleDocument,
  type UseCaseBundleV2Wrapper,
} from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';
import { ensureUseCaseResponse } from '../aiAgentUseCase/useCaseResponseTasks';

export function isUseCaseBundleV2Wrapper(value: unknown): value is UseCaseBundleV2Wrapper {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const ver = o.useCaseBundleSchemaVersion;
  return (
    (ver === USE_CASE_BUNDLE_SCHEMA_VERSION_V2 || ver === USE_CASE_BUNDLE_SCHEMA_VERSION) &&
    Array.isArray(o.use_cases)
  );
}

export type ParsedUseCaseBundleDocument = {
  useCases: AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
};

function normalizeUseCaseList(list: AIAgentUseCase[]): AIAgentUseCase[] {
  return list.map((uc) => ensureUseCaseResponse(ensureUseCasePhrases(uc)));
}

/**
 * Parse `agentUseCasesJson` grezzo → use case + categorie (v3 o migrazione v1/v2).
 */
export function parseAgentUseCaseBundleDocument(raw: string | undefined): ParsedUseCaseBundleDocument {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { useCases: [], categories: [] };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        useCases: normalizeUseCaseList(parseAgentUseCasesJsonLegacyArray(parsed)),
        categories: [],
      };
    }
    if (isUseCaseBundleV2Wrapper(parsed)) {
      const useCases = normalizeUseCaseList(parseAgentUseCasesJsonLegacyArray(parsed.use_cases));
      const categories = parseUseCaseCategoriesFromBundle(parsed.categories);
      return { useCases, categories };
    }
    return { useCases: [], categories: [] };
  } catch {
    return { useCases: [], categories: [] };
  }
}

/**
 * Parse `agentUseCasesJson` grezzo → use case normalizzati (compat: ignora categorie nel return).
 */
export function parseAgentUseCaseBundleJson(raw: string | undefined): AIAgentUseCase[] {
  return parseAgentUseCaseBundleDocument(raw).useCases;
}

/**
 * Serializza il bundle in formato v3 ufficiale.
 */
export function serializeAgentUseCaseBundle(
  useCases: readonly AIAgentUseCase[],
  categories: readonly AIAgentUseCaseCategory[] = []
): string {
  const wrapper: UseCaseBundleDocument = {
    useCaseBundleSchemaVersion: USE_CASE_BUNDLE_SCHEMA_VERSION,
    categories: [...categories],
    use_cases: useCases.map((uc) => ensureUseCasePhrases(uc)),
  };
  return JSON.stringify(wrapper);
}

export function getBundleSchemaVersionFromRaw(raw: string | undefined): number | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return 1;
    if (isUseCaseBundleV2Wrapper(parsed)) {
      return parsed.useCaseBundleSchemaVersion === USE_CASE_BUNDLE_SCHEMA_VERSION
        ? USE_CASE_BUNDLE_SCHEMA_VERSION
        : USE_CASE_BUNDLE_SCHEMA_VERSION_V2;
    }
    return null;
  } catch {
    return null;
  }
}

