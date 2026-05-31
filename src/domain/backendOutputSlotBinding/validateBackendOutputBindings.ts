/**
 * Validazione compile: ogni token deployabile deve avere `fillFrom` quando ci sono backend collegati.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import { isUnclassifiedSlotId } from '@domain/useCaseBundle/projectSlotLexicon';
import { isUseCaseIncludedInConversations } from '@types/aiAgentUseCases';
import { isStartAgentUseCase } from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import type { AgentBackendOutputSlotBindings } from './types';
import { resolveCanonicalSlotIdFromToken, isResolvableCanonicalSlotId } from './resolveCanonicalSlotId';

export type BackendBindingValidationStatus = 'valid' | 'invalid' | 'skipped';

export interface BackendBindingValidationResult {
  status: BackendBindingValidationStatus;
  reasons: string[];
}

function collectTokensFromUseCases(useCases: readonly AIAgentUseCase[]): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const uc of useCases) {
    if (!isUseCaseIncludedInConversations(uc) || isStartAgentUseCase(uc)) continue;
    const withPhrases = ensureUseCasePhrases(uc);
    for (const phrase of withPhrases.phrases ?? []) {
      for (const variant of phrase.variants) {
        const compiled = variant.compiled;
        if (!compiled?.tokenizedText?.trim()) continue;
        for (const token of compiled.tokens ?? []) {
          if (seen.has(token)) continue;
          seen.add(token);
          tokens.push(token);
        }
      }
    }
  }
  return tokens;
}

/**
 * @param backendLinked true se l'agente ha almeno un backend tool collegato.
 */
export function validateBackendOutputBindings(
  useCases: readonly AIAgentUseCase[],
  bindings: AgentBackendOutputSlotBindings,
  backendLinked: boolean
): BackendBindingValidationResult {
  if (!backendLinked) {
    return { status: 'skipped', reasons: [] };
  }

  const reasons: string[] = [];
  const contracts = bindings.slotContracts ?? [];

  function slotHasReceive(slotId: string): boolean {
    const c = contracts.find((x) => x.slotId === slotId);
    if (c?.receive.trim()) return true;
    return bindings.rows.some((r) => r.slotId === slotId && r.apiPath.trim());
  }

  function slotHasToolName(slotId: string): boolean {
    const c = contracts.find((x) => x.slotId === slotId);
    if (!c) return true;
    return Boolean(c.toolName.trim());
  }

  if (bindings.rows.length === 0 && contracts.length === 0) {
    reasons.push('Nessun binding backend→slot (esegui Compila o collega RECEIVE)');
  }

  const tokens = collectTokensFromUseCases(useCases);
  let missingFill = 0;
  let missingTool = 0;
  let undefinedSlots = 0;

  for (const token of tokens) {
    const slotId = resolveCanonicalSlotIdFromToken(token);
    if (isUnclassifiedSlotId(slotId)) {
      undefinedSlots += 1;
      continue;
    }
    if (!isResolvableCanonicalSlotId(slotId)) continue;
    if (!slotHasReceive(slotId)) {
      missingFill += 1;
      continue;
    }
    if (!slotHasToolName(slotId)) {
      missingTool += 1;
    }
  }

  if (undefinedSlots > 0) {
    reasons.push(`${undefinedSlots} token con categoria non classificata`);
  }
  if (missingFill > 0) {
    reasons.push(`${missingFill} token senza fillFrom backend`);
  }
  if (missingTool > 0) {
    reasons.push(`${missingTool} slot senza toolName nel contratto backend`);
  }

  if (reasons.length === 0) {
    return { status: 'valid', reasons: [] };
  }
  return { status: 'invalid', reasons };
}

/** Messaggio banner per la toolbar wizard. */
export function formatCompileMappingBanner(
  slotReasons: readonly string[],
  backendReasons: readonly string[]
): string {
  const parts = [...slotReasons, ...backendReasons].filter(Boolean);
  if (parts.length === 0) return 'MAPPED — Slot mapping e binding backend validi';
  return `MAPPING — ${parts.join('; ')}`;
}
