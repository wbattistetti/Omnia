/**
 * Unit tests — retrieval manuale Tutor per tab (RAG).
 */

import { describe, expect, it } from 'vitest';
import { DESIGNER_MANUAL_FOR_TUTOR } from '../manuals/composeDesignerManual';
import {
  findMatchingSubsection,
  retrieveManualForTutor,
  splitManualSections,
} from '../tutorManualRetrieval';

describe('splitManualSections', () => {
  it('splits markdown on ## headings', () => {
    const sections = splitManualSections('## A\nline1\n\n## B\nline2');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.heading).toBe('A');
    expect(sections[1]?.body).toContain('line2');
  });
});

describe('retrieveManualForTutor', () => {
  it('returns backend section for backend tab', () => {
    const chunk = retrieveManualForTutor({
      fullManual: DESIGNER_MANUAL_FOR_TUTOR,
      activePhaseKey: 'backend',
      detectedPhaseKey: 'backend',
      question: 'Come funziona Test API?',
    });
    expect(chunk).toMatch(/BACKEND/i);
    expect(chunk).not.toBe('NESSUN CONTENUTO MANUALE PER QUESTA FASE.');
  });

  it('returns only active tab section when detected phase differs (strict RAG)', () => {
    const chunk = retrieveManualForTutor({
      fullManual: DESIGNER_MANUAL_FOR_TUTOR,
      activePhaseKey: 'task',
      detectedPhaseKey: 'knowledgeBase',
      question: 'Come carico un documento?',
    });
    expect(chunk).toMatch(/TASK/i);
    expect(chunk).not.toMatch(/KNOWLEDGE BASE/i);
  });

  it('includes error handling section', () => {
    const chunk = retrieveManualForTutor({
      fullManual: DESIGNER_MANUAL_FOR_TUTOR,
      activePhaseKey: 'errorHandling',
      detectedPhaseKey: 'errorHandling',
      question: 'Regole conversazionali',
    });
    expect(chunk).toMatch(/ERROR HANDLING/i);
  });
});

describe('findMatchingSubsection', () => {
  it('finds ### subsection when question mentions heading fragment', () => {
    const sections = splitManualSections(DESIGNER_MANUAL_FOR_TUTOR);
    const match = findMatchingSubsection('Spiegami il flusso consigliato backend api', sections);
    expect(match).toBeTruthy();
    expect(match).toMatch(/Flusso consigliato/i);
  });
});
