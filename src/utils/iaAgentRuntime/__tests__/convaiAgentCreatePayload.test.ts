import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultConfig } from '../platformHelpers';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

const resolveElevenLabsMock = vi.fn<(task: Task, opts?: unknown) => string>();
vi.mock('@components/TaskEditor/EditorHost/editors/aiAgentEditor/resolveAiAgentPlatformRulesString', () => ({
  resolveElevenLabsAgentPromptFromTask: (task: Task, opts?: unknown) => resolveElevenLabsMock(task, opts),
}));

import { DEV_TUNNEL_COMPILE_FLAG_KEY } from '@domain/devTunnel/devTunnelCompileBridge';
import {
  buildConvaiProvisionKey,
  conversationConfigForConvaiApi,
  conversationConfigFragmentFromIaAgentConfig,
} from '../convaiAgentCreatePayload';

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
  beforeEach(() => {
    resolveElevenLabsMock.mockImplementation((task: Task) => String(task.agentPrompt ?? '').trim());
  });

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

  it('coerces stale eleven_flash_v2 ttsModel to v2_5 for Italian agents', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Italian TTS coerce.';
    cfg.voice = { id: 'voice_it', language: 'it', settings: {} };
    cfg.ttsModel = 'eleven_flash_v2';
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect(frag!.tts).toEqual({ voice_id: 'voice_it', model_id: 'eleven_flash_v2_5' });
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

  it('omitTts skips voice_id but keeps model_id v2_5 for Italian (ElevenLabs create validation)', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Omit TTS test prompt.';
    cfg.voice = { id: 'prim', language: 'it', settings: {} };
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg, { omitTts: true });
    expect(frag!.tts).toEqual({ model_id: 'eleven_flash_v2_5' });
    expect((frag!.tts as Record<string, unknown>).voice_id).toBeUndefined();
  });

  it('omitTts skips entire tts block for English agents', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Omit TTS test prompt.';
    cfg.voices = [{ id: 'prim', role: 'primary' }];
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg, { omitTts: true });
    expect(frag!.tts).toBeUndefined();
  });

  it('includes model_id v2_5 for Italian agent without voice_id', () => {
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'Italian agent without voice.';
    cfg.voice = { id: '', language: 'it', settings: {} };
    const frag = conversationConfigFragmentFromIaAgentConfig(cfg);
    expect(frag!.tts).toEqual({ model_id: 'eleven_flash_v2_5' });
    expect((frag!.tts as Record<string, unknown>).voice_id).toBeUndefined();
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

describe('conversationConfigForConvaiApi (dev tunnel)', () => {
  const LS_MAP = 'omnia.devTunnel.portToPublicBaseJson';

  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal(
      'localStorage',
      {
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
        clear: () => map.clear(),
        length: 0,
        key: () => null,
      } as Storage
    );
  });

  it('riscriv api_schema.url se la mappa tunnel ha la porta, anche con «Compilazione con tunnel» off', () => {
    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '0');
    localStorage.setItem(LS_MAP, JSON.stringify({ 3110: 'https://pub.example' }));
    const frag: Record<string, unknown> = {
      agent: {
        prompt: {
          tools: [{ api_schema: { url: 'http://localhost:3110/slots' } }],
        },
      },
    };
    const out = conversationConfigForConvaiApi(frag)!;
    const tools = ((out.agent as Record<string, unknown>).prompt as Record<string, unknown>).tools as Array<{
      api_schema: { url: string };
    }>;
    expect(tools[0].api_schema.url).toBe('https://pub.example/slots');
  });

  it('riscriv api_schema.url dei webhook come il compile orchestrator', () => {
    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '1');
    localStorage.setItem(LS_MAP, JSON.stringify({ 3110: 'https://pub.example' }));
    const frag: Record<string, unknown> = {
      agent: {
        prompt: {
          tools: [{ type: 'webhook', api_schema: { url: 'http://localhost:3110/slots', method: 'GET' } }],
        },
      },
    };
    const out = conversationConfigForConvaiApi(frag)!;
    const tools = ((out.agent as Record<string, unknown>).prompt as Record<string, unknown>).tools as Array<{
      api_schema: { url: string };
    }>;
    expect(tools[0].api_schema.url).toBe('https://pub.example/slots');
  });

  it('buildConvaiProvisionKey non include URL tunnel (chiave stabile se ngrok cambia)', () => {
    localStorage.setItem(DEV_TUNNEL_COMPILE_FLAG_KEY, '1');
    localStorage.setItem(LS_MAP, JSON.stringify({ 3110: 'https://session-only.ngrok.app' }));
    const cfg = getDefaultConfig('elevenlabs');
    cfg.systemPrompt = 'p';
    cfg.voice = { id: 'v', language: 'en', settings: {} };
    const key = buildConvaiProvisionKey(cfg, undefined, false);
    expect(key.length).toBeGreaterThan(0);
    expect(key).not.toContain('session-only.ngrok.app');
  });
});
