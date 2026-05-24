import { describe, expect, it } from 'vitest';
import { getTutorScriptMessage } from '../tutorScripts';
import { UI_IDS } from '../tutorUiIds';

describe('getTutorScriptMessage task idle', () => {
  it('guides empty description to task input with glow', () => {
    const script = getTutorScriptMessage(0, 'idle', 'main', {
      designDescriptionTrimmed: '',
      hasAgentGeneration: false,
    });
    expect(script?.text).toMatch(/Inizia descrivendo/i);
    expect(script?.attentionTargetId).toBe(UI_IDS.taskInput);
    expect(script?.attentionType).toBe('glow');
  });

  it('with draft points to Create Agent', () => {
    const script = getTutorScriptMessage(0, 'idle', 'main', {
      designDescriptionTrimmed: 'Aiuta con prenotazioni',
      hasAgentGeneration: false,
    });
    expect(script?.text).toMatch(/Create Agent/i);
    expect(script?.attentionTargetId).toBe(UI_IDS.createAgentButton);
    expect(script?.attentionType).toBe('blink');
  });

  it('after generation suggests refine', () => {
    const script = getTutorScriptMessage(0, 'idle', 'main', {
      designDescriptionTrimmed: 'Testo esistente',
      hasAgentGeneration: true,
    });
    expect(script?.text).toMatch(/Refine comportamento/i);
    expect(script?.attentionTargetId).toBe(UI_IDS.createAgentButton);
  });

  it('prompts idle highlights use case list', () => {
    const script = getTutorScriptMessage(3, 'idle', 'main', {
      designDescriptionTrimmed: '',
      hasAgentGeneration: false,
    });
    expect(script?.attentionTargetId).toBe(UI_IDS.promptsMainEditor);
    expect(script?.attentionType).toBe('glow');
  });
});
