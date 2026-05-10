/**
 * Sovrascrive il primo turno assistente con testo ancora in bozza nell’editor (wizard piano stile).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export function mergeAssistantPhraseDraftIntoUseCases(
  useCases: readonly AIAgentUseCase[],
  draftById: Readonly<Record<string, string>>
): AIAgentUseCase[] {
  const keys = Object.keys(draftById);
  if (keys.length === 0) return [...useCases];
  return useCases.map((u) => {
    const draft = draftById[u.id];
    if (draft === undefined) return u;
    const turnId = u.dialogue.find((t) => t.role === 'assistant')?.turn_id;
    if (!turnId) return u;
    return {
      ...u,
      dialogue: u.dialogue.map((t) =>
        t.turn_id === turnId && t.role === 'assistant' ? { ...t, content: draft } : t
      ),
    };
  });
}
