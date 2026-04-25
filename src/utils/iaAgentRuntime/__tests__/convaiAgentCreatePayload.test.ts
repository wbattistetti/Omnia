import { describe, expect, it } from 'vitest';
import { conversationConfigFragmentFromIaAgentConfig } from '../convaiAgentCreatePayload';
import { getDefaultConfig } from '../platformHelpers';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

function minimalTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    instanceId: 't1',
    type: TaskType.AIAgent,
    agentRuntimeCompactJson: '',
    agentPrompt: '',
    ...overrides,
  } as Task;
}

describe('conversationConfigFragmentFromIaAgentConfig', () => {
  it('returns null for non-elevenlabs platforms', () => {
    expect(conversationConfigFragmentFromIaAgentConfig(getDefaultConfig('openai'))).toBeNull();
  });

  it('maps BCP-47 voice language to ISO 639-1 for ElevenLabs agent.language', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Prompt richiesto per createAgent.';
    cfg.voice = { id: 'v', language: 'it-IT', settings: {} };
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect((frag!.agent as Record<string, unknown>).language).toBe('it');
  });

  it('maps voice id, language, llm prompt from IA config', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Act as a bank assistant.';
    cfg.voice = { id: 'voice_x', language: 'it', settings: {} };
    cfg.advanced = {
      ...cfg.advanced,
      llm: {
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 2048,
        reflection_budget: 2,
      },
    };

    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect(frag).not.toBeNull();
    expect(frag!.tts).toEqual({ voice_id: 'voice_x', model_id: 'eleven_flash_v2_5' });

    const cfgExplicit = getDefaultConfig('elevenlabs');
    cfgExplicit.systemPrompt = 'Act as a bank assistant.';
    cfgExplicit.voice = { id: 'voice_x', language: 'it', settings: {} };
    cfgExplicit.ttsModel = 'eleven_turbo_v2_5';
    const fragExplicit = conversationConfigFragmentFromIaAgentConfig(cfgExplicit);
    expect(fragExplicit!.tts).toEqual({ voice_id: 'voice_x', model_id: 'eleven_turbo_v2_5' });
    expect((frag!.agent as Record<string, unknown>).language).toBe('it');
    const prompt = (frag!.agent as Record<string, unknown>).prompt as Record<string, unknown>;
    expect(prompt.prompt).toBe('Act as a bank assistant.');
    expect(prompt.llm).toBe('gpt-4o');
    expect(prompt.temperature).toBe(0.3);
    expect(prompt.max_tokens).toBe(2048);
  });

  it('uses primary voice from voices array when set', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Voice lineup test prompt.';
    cfg.voices = [
      { id: 'prim', role: 'primary' },
      { id: 'sec', role: 'secondary' },
    ];
    cfg.voice = { id: '', language: 'en', settings: {} };

    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect(frag!.tts).toEqual({ voice_id: 'prim', model_id: 'eleven_flash_v2' });
  });

  it('sets default tts.model_id to eleven_flash_v2 when agent language is English', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'English agent prompt.';
    cfg.voice = { id: 'voice_en', language: 'en', settings: {} };
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect(frag!.tts).toEqual({ voice_id: 'voice_en', model_id: 'eleven_flash_v2' });
  });

  it('maps gpt-4o-mini to gpt-4o for ElevenLabs residency createAgent compatibility', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'LLM mapping test.';
    cfg.advanced = {
      ...cfg.advanced,
      llm: { model: 'gpt-4o-mini', temperature: 0.5, max_tokens: 100, reflection_budget: 1 },
    };
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    const prompt = (frag!.agent as Record<string, unknown>).prompt as Record<string, unknown>;
    expect(prompt.llm).toBe('gpt-4o');
  });

  it('omitTts skips tts block for auto-provision (EU cluster voice mismatch)', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Omit TTS test prompt.';
    cfg.voices = [{ id: 'prim', role: 'primary' }];
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg, { omitTts: true });
    expect(frag).not.toBeNull();
    expect(frag!.tts).toBeUndefined();
    expect((frag!.agent as Record<string, unknown>).first_message).toMatch(/Hello!/);
  });

  it('sends exact editor rules text when task is passed (not cfg.systemPrompt)', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'RUNTIME_ONLY_SHOULD_NOT_WIN';
    cfg.voice = { id: 'v', language: 'en', settings: {} };
    const task = minimalTask({ agentPrompt: 'EDITOR_PROMPT_EXACT', agentRuntimeCompactJson: '' });
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg, { task });
    const prompt = (frag!.agent as Record<string, unknown>).prompt as Record<string, unknown>;
    expect(prompt.prompt).toBe('EDITOR_PROMPT_EXACT');
  });

  it('throws when task is passed but editor and runtime systemPrompt are empty', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = '';
    cfg.voice = { id: 'v', language: 'en', settings: {} };
    const task = minimalTask({ agentPrompt: '', agentRuntimeCompactJson: '' });
    expect(() => conversationConfigFragmentFromIaAgentConfig(cfg, { task })).toThrow(/prompt del task vuoto/i);
  });

  it('when task editor is empty but runtime systemPrompt is set, uses runtime prompt', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'ONLY_IN_RUNTIME_JSON';
    cfg.voice = { id: 'v', language: 'en', settings: {} };
    const task = minimalTask({ agentPrompt: '', agentRuntimeCompactJson: '' });
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg, { task });
    const prompt = (frag!.agent as Record<string, unknown>).prompt as Record<string, unknown>;
    expect(prompt.prompt).toBe('ONLY_IN_RUNTIME_JSON');
  });

  it('throws when no task and systemPrompt is empty', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = '';
    cfg.voice = { id: 'v', language: 'en', settings: {} };
    expect(() => conversationConfigFragmentFromIaAgentConfig(cfg)).toThrow(/prompt vuoto/i);
  });
});
