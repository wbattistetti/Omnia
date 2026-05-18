/**
 * Sincronizza le baseline triplet (label/payoff/messaggio) quando la lista use case cambia (nuovi id o rimozioni).
 */

import * as React from 'react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AiTripletFieldBaseline } from './useCaseComposerPresentation';

export function useUseCaseFieldBaselineSync(
  ordered: readonly AIAgentUseCase[],
  useCases: readonly AIAgentUseCase[],
  setFieldBaselineByUseCaseId: React.Dispatch<
    React.SetStateAction<Record<string, AiTripletFieldBaseline>>
  >
): void {
  React.useEffect(() => {
    setFieldBaselineByUseCaseId((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const u of ordered) {
        if (next[u.id]) continue;
        const ast = u.dialogue.find((t) => t.role === 'assistant');
        next[u.id] = {
          label: u.label,
          payoff: u.payoff ?? '',
          assistantContent: ast?.content ?? '',
        };
        changed = true;
      }
      for (const id of Object.keys(next)) {
        if (!ordered.some((u) => u.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [ordered, setFieldBaselineByUseCaseId]);
}
