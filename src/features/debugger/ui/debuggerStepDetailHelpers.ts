/**
 * Helpers per capire se uno DebuggerStep ha già payload NLU o grafo significativo.
 */
import type { DebuggerStep } from '../core/DebuggerStep';

export function hasNluDetail(step: DebuggerStep): boolean {
  const sem = String(step.semanticValue || '').trim();
  const ling = String(step.linguisticValue || '').trim();
  if (sem || ling) return true;
  const contract = String(step.grammar?.contract || '').trim();
  if (contract && contract !== 'stateUpdate') return true;
  return false;
}

export function hasGraphDetail(step: DebuggerStep): boolean {
  return Boolean(
    String(step.activeNodeId || '').trim() ||
      (step.passedNodeIds?.length ?? 0) > 0 ||
      String(step.activeEdgeId || '').trim()
  );
}
