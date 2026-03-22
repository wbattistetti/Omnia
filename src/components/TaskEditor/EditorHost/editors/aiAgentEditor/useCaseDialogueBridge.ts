/**
 * Maps use case dialogue + bubble_notes to AIAgentPreviewTurn[] for AIAgentPreviewChatPanel.
 */

import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import type { AIAgentUseCaseTurn } from '@types/aiAgentUseCases';
import { newAgentUseCaseTurnId } from '@types/aiAgentUseCases';

export function useCaseDialogueToPreview(
  dialogue: readonly AIAgentUseCaseTurn[],
  bubble_notes: Readonly<Record<string, string>>
): AIAgentPreviewTurn[] {
  return dialogue.map((t) => ({
    role: t.role,
    content: t.content,
    logicalStepId: t.turn_id,
    designerNote: bubble_notes[t.turn_id],
  }));
}

export function previewToUseCaseDialogue(
  turns: readonly AIAgentPreviewTurn[],
  prev: readonly AIAgentUseCaseTurn[]
): { dialogue: AIAgentUseCaseTurn[]; bubble_notes: Record<string, string> } {
  const dialogue: AIAgentUseCaseTurn[] = turns.map((t, i) => {
    const p = prev[i];
    const turn_id =
      typeof t.logicalStepId === 'string' && t.logicalStepId.trim()
        ? t.logicalStepId.trim()
        : p?.turn_id ?? newAgentUseCaseTurnId();
    return {
      turn_id,
      role: t.role === 'user' ? 'user' : 'assistant',
      content: t.content,
      userEdited: p?.userEdited,
      locked: p?.locked,
    };
  });
  const bubble_notes: Record<string, string> = {};
  for (let i = 0; i < turns.length; i++) {
    const id = dialogue[i].turn_id;
    const note = turns[i].designerNote;
    if (typeof note === 'string' && note.trim()) bubble_notes[id] = note.trim();
  }
  return { dialogue, bubble_notes };
}
