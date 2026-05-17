import { describe, expect, it } from 'vitest';
import { extractConvaiAgentSettings } from '../extractConvaiAgentSettings';

describe('extractConvaiAgentSettings', () => {
  it('reads agent prompt, voice, llm and workflow flags', () => {
    const settings = extractConvaiAgentSettings(
      {
        agent: {
          prompt: { prompt: 'System' },
          first_message: 'Ciao',
          language: 'it',
          llm: { model: 'gpt-4o' },
          tts: { voice_id: 'voice_1', model: 'eleven_turbo_v2' },
        },
      },
      { prevent_subagent_loops: true }
    );
    expect(settings.globalPrompt).toBe('System');
    expect(settings.firstMessage).toBe('Ciao');
    expect(settings.language).toBe('it');
    expect(settings.llm).toBe('gpt-4o');
    expect(settings.voiceId).toBe('voice_1');
    expect(settings.ttsModel).toBe('eleven_turbo_v2');
    expect(settings.preventSubagentLoops).toBe(true);
  });
});
