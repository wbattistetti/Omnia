/**
 * Unit tests — manuale designer completo per Tutor Q&A.
 */

import { describe, expect, it } from 'vitest';
import { DESIGNER_MANUAL_FOR_TUTOR } from '../manuals/composeDesignerManual';

describe('DESIGNER_MANUAL_FOR_TUTOR', () => {
  it('contains all seven wizard phases', () => {
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('TASK');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('KNOWLEDGE BASE');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('BACKEND');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('PROMPTS');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('ERROR HANDLING');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('DATI');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('VOCE');
  });

  it('documents real UI labels for backend', () => {
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Add backend');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Recupera specifiche');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Test API');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Knowledge Base');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('MOCK/REAL');
  });

  it('includes overview map, glossary and Q&A sections', () => {
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('MANUALETTO GENERALE');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Cosa devo fare adesso');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Due tipi di «completamento»');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Glossario');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Domande frequenti');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Interpreta I/O');
  });

  it('documents prompts sub-wizard stations', () => {
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain("Casi d'uso");
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Conversazioni');
    expect(DESIGNER_MANUAL_FOR_TUTOR).toContain('Prompt e JSON');
  });

  it('is substantial enough for LLM grounding', () => {
    expect(DESIGNER_MANUAL_FOR_TUTOR.length).toBeGreaterThan(15000);
  });
});
