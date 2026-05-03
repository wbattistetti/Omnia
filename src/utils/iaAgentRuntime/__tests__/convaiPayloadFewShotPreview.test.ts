import { describe, expect, it } from 'vitest';
import {
  formatFewShotOnlyDisplay,
  formatFewShotTabCombined,
  parseConvaiCreateAgentFewShotPreview,
} from '../convaiPayloadFewShotPreview';

describe('parseConvaiCreateAgentFewShotPreview', () => {
  it('extracts Examples body when present in prompt markdown', () => {
    const prompt = ['### Goal', '', 'x', '', '### Examples', '', 'User: Hi', 'Assistant: Hello'].join('\n');
    const payload = JSON.stringify({
      name: 't',
      conversation_config: {
        agent: {
          prompt: { prompt, llm: 'gpt-4o' },
        },
      },
    });
    const r = parseConvaiCreateAgentFewShotPreview(payload);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.hasExamples).toBe(true);
    expect(r.examplesBody).toContain('User: Hi');
    expect(formatFewShotOnlyDisplay(r)).toContain('### Examples');
  });

  it('reports no examples when section missing', () => {
    const payload = JSON.stringify({
      conversation_config: {
        agent: {
          prompt: { prompt: '### Goal\n\nonly goal', llm: 'gpt-4o' },
        },
      },
    });
    const r = parseConvaiCreateAgentFewShotPreview(payload);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.hasExamples).toBe(false);
    expect(formatFewShotOnlyDisplay(r)).toMatch(/Nessuna sezione/);
  });

  it('errors on invalid JSON', () => {
    const r = parseConvaiCreateAgentFewShotPreview('{');
    expect(r.kind).toBe('error');
    if (r.kind !== 'error') return;
    expect(r.message).toMatch(/fallback/i);
  });

  it('falls back to loose extraction when JSON has trailing comma but prompt is readable', () => {
    const inner =
      '### Goal\n\nx\n\n### Examples\n\nUser: ciao\nAssistant: salve';
    const payload = [
      '{"name":"t","conversation_config":{"agent":{"first_message":"","language":"it","prompt":{"prompt":',
      JSON.stringify(inner),
      ',"llm":"gpt-4o"}}}},',
    ].join('');
    const r = parseConvaiCreateAgentFewShotPreview(payload);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.hasExamples).toBe(true);
    expect(r.examplesBody).toContain('User: ciao');
  });

  it('explains comment-only debug payloads', () => {
    const r = parseConvaiCreateAgentFewShotPreview('// Debug Run: foo\n');
    expect(r.kind).toBe('error');
    if (r.kind !== 'error') return;
    expect(r.message).toMatch(/non è JSON|placeholder/i);
  });
});

describe('formatFewShotTabCombined', () => {
  it('appends use case block after payload section', () => {
    const payload = JSON.stringify({
      conversation_config: {
        agent: { prompt: { prompt: '### Goal\n\nx', llm: 'gpt-4o' } },
      },
    });
    const out = formatFewShotTabCombined(payload, '• UC\n\nUtente: hi');
    expect(out).toMatch(/Nel POST createAgent/);
    expect(out).toMatch(/agentUseCasesJson/);
    expect(out).toContain('Utente: hi');
  });
});
