/**
 * Tests mapping between use case dialogue and preview turns (turn_id / bubble_notes).
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentUseCaseTurn } from '@types/aiAgentUseCases';
import { previewToUseCaseDialogue, useCaseDialogueToPreview } from './useCaseDialogueBridge';

describe('useCaseDialogueBridge', () => {
  it('round-trips turn_id via logicalStepId and bubble_notes', () => {
    const dialogue: AIAgentUseCaseTurn[] = [
      { turn_id: 't-a', role: 'assistant', content: 'Hi' },
      { turn_id: 't-b', role: 'user', content: 'Yo' },
    ];
    const bubble_notes = { 't-a': 'note a' };
    const preview = useCaseDialogueToPreview(dialogue, bubble_notes);
    expect(preview[0].logicalStepId).toBe('t-a');
    expect(preview[0].designerNote).toBe('note a');
    const back = previewToUseCaseDialogue(preview, dialogue);
    expect(back.dialogue.map((d) => d.turn_id)).toEqual(['t-a', 't-b']);
    expect(back.bubble_notes['t-a']).toBe('note a');
  });
});
