/**
 * Unit tests — routing keyword domande tutor per fase.
 */

import { describe, expect, it } from 'vitest';
import { routeTutorQuestion } from '../tutorQuestionRouter';

describe('routeTutorQuestion', () => {
  it('routes backend question from task tab to backend', () => {
    const result = routeTutorQuestion('Come definisco un backend?', 'task');
    expect(result.detectedPhase).toBe('backend');
    expect(result.belongsToActivePhase).toBe(false);
  });

  it('routes tone question from prompts tab to task', () => {
    const result = routeTutorQuestion('Come imposto il tono dell\'agente?', 'prompts');
    expect(result.detectedPhase).toBe('task');
    expect(result.belongsToActivePhase).toBe(false);
  });

  it('keeps question in active tab when keywords match active phase', () => {
    const result = routeTutorQuestion('Come scrivo la descrizione del task?', 'task');
    expect(result.detectedPhase).toBe('task');
    expect(result.belongsToActivePhase).toBe(true);
  });

  it('falls back to active tab when no keyword matches', () => {
    const result = routeTutorQuestion('Ciao tutor', 'dati');
    expect(result.detectedPhase).toBe('dati');
    expect(result.belongsToActivePhase).toBe(true);
  });

  it('routes schema questions to dati', () => {
    const result = routeTutorQuestion('Come definisco lo schema dei campi?', 'backend');
    expect(result.detectedPhase).toBe('dati');
    expect(result.belongsToActivePhase).toBe(false);
  });
});
