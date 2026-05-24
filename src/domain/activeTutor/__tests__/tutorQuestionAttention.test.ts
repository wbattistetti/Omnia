/**
 * Unit tests — attenzione UI da domande libere Tutor.
 */

import { describe, expect, it } from 'vitest';
import { resolveTutorQuestionAttention } from '../tutorQuestionAttention';
import { UI_IDS } from '../tutorUiIds';

describe('resolveTutorQuestionAttention', () => {
  it('targets Create Agent when asked about create agent', () => {
    const t = resolveTutorQuestionAttention('Dove clicco Create Agent?', 'task');
    expect(t.elementId).toBe(UI_IDS.createAgentButton);
    expect(t.type).toBe('blink');
  });

  it('targets task description for description questions', () => {
    const t = resolveTutorQuestionAttention('Cosa scrivo nella descrizione?', 'task');
    expect(t.elementId).toBe(UI_IDS.taskDescriptionInput);
    expect(t.type).toBe('glow');
  });

  it('targets backend list for Test API with ensureView', () => {
    const t = resolveTutorQuestionAttention('Come faccio Test API?', 'backend');
    expect(t.elementId).toBe(UI_IDS.backendList);
    expect(t.ensureView).toBe('backendMain');
  });

  it('targets KB list for document questions', () => {
    const t = resolveTutorQuestionAttention('Dove carico i documenti PDF?', 'backend');
    expect(t.elementId).toBe(UI_IDS.kbDocumentList);
    expect(t.ensureView).toBe('knowledgeBase');
  });

  it('falls back to phase main element for generic questions', () => {
    const t = resolveTutorQuestionAttention('Ciao', 'prompts');
    expect(t.elementId).toBe(UI_IDS.promptsMainEditor);
    expect(t.phaseKey).toBe('prompts');
  });
});
