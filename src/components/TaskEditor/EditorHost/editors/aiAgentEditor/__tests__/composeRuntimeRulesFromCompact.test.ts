/**
 * Tests for compact runtime JSON parsing and rules composition.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMinimalAiAgentCompileTask,
  composeRulesTextFromRuntimeCompact,
  parseAgentRuntimeCompactJson,
  rulesStringForCompilerFromTaskFields,
  rulesStringForAiAgentCompile,
} from '../composeRuntimeRulesFromCompact';

describe('composeRuntimeRulesFromCompact', () => {
  it('parseAgentRuntimeCompactJson returns null for empty or invalid', () => {
    expect(parseAgentRuntimeCompactJson('')).toBeNull();
    expect(parseAgentRuntimeCompactJson('not json')).toBeNull();
    expect(parseAgentRuntimeCompactJson('{}')).toBeNull();
  });

  it('parses valid compact JSON', () => {
    const rc = {
      behavior_compact: 'Do A.',
      constraints_compact: 'Must B.',
      sequence_compact: 'Step 1.',
      corrections_compact: 'Fix C.',
      examples_compact: [
        { role: 'assistant' as const, content: 'Hi' },
        { role: 'user' as const, content: 'Yo' },
      ],
    };
    const json = JSON.stringify(rc);
    expect(parseAgentRuntimeCompactJson(json)).toEqual(rc);
  });

  it('composeRulesTextFromRuntimeCompact joins four fields', () => {
    const text = composeRulesTextFromRuntimeCompact({
      behavior_compact: 'One',
      constraints_compact: 'Two',
      sequence_compact: 'Three',
      corrections_compact: 'Four',
      examples_compact: [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'y' }],
    });
    expect(text).toBe('One\n\nTwo\n\nThree\n\nFour');
  });

  it('rulesStringForCompilerFromTaskFields prefers compact over agentPrompt', () => {
    const rules = rulesStringForCompilerFromTaskFields({
      agentRuntimeCompactJson: JSON.stringify({
        behavior_compact: 'Goal.',
        constraints_compact: 'Must A.',
        sequence_compact: 'Step one.',
        corrections_compact: 'Fix B.',
        examples_compact: [
          { role: 'assistant' as const, content: 'Hi' },
          { role: 'user' as const, content: 'Yo' },
        ],
      }),
      agentPrompt: 'IGNORE THIS LONG MARKDOWN',
    });
    expect(rules).toContain('Goal.');
    expect(rules).not.toContain('IGNORE');
  });

  it('rulesStringForCompilerFromTaskFields falls back to agentPrompt when compact invalid', () => {
    const rules = rulesStringForCompilerFromTaskFields({
      agentRuntimeCompactJson: '',
      agentPrompt: '## Rich only',
    });
    expect(rules).toBe('## Rich only');
  });

  it('rulesStringForAiAgentCompile rich uses agentPrompt and appends examples', () => {
    const compact = {
      behavior_compact: 'G.',
      constraints_compact: 'C.',
      sequence_compact: 'S.',
      corrections_compact: 'R.',
      examples_compact: [
        { role: 'assistant' as const, content: 'A' },
        { role: 'user' as const, content: 'B' },
      ],
    };
    const rules = rulesStringForAiAgentCompile(
      {
        agentRuntimeCompactJson: JSON.stringify(compact),
        agentPrompt: '## Full markdown',
      },
      'rich'
    );
    expect(rules).toContain('## Full markdown');
    expect(rules).toContain('Style examples');
  });

  it('buildMinimalAiAgentCompileTask returns only compile fields', () => {
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'task-1',
      type: 6,
      templateId: null,
      llmEndpoint: '',
      agentRuntimeCompactJson: JSON.stringify({
        behavior_compact: 'Goal.',
        constraints_compact: 'Must A.',
        sequence_compact: 'Step.',
        corrections_compact: 'Fix.',
        examples_compact: [
          { role: 'assistant' as const, content: 'Hi' },
          { role: 'user' as const, content: 'Yo' },
        ],
      }),
      agentPrompt: 'SHOULD NOT APPEAR',
    });
    expect(minimal.id).toBe('task-1');
    expect(minimal.type).toBe(6);
    expect(minimal.rules).toContain('Goal.');
    expect(minimal.rules).not.toContain('SHOULD NOT');
    expect(minimal.llmEndpoint).toBe('http://localhost:3100/api/runtime/ai-agent/step');
    expect(Object.keys(minimal).sort()).toEqual(['id', 'llmEndpoint', 'rules', 'templateId', 'type'].sort());
  });

  it('buildMinimalAiAgentCompileTask keeps explicit llmEndpoint', () => {
    const custom = 'https://example.com/step';
    const minimal = buildMinimalAiAgentCompileTask({
      id: 'x',
      type: 6,
      templateId: null,
      llmEndpoint: custom,
      agentRuntimeCompactJson: JSON.stringify({
        behavior_compact: 'Goal.',
        constraints_compact: 'Must A.',
        sequence_compact: 'Step.',
        corrections_compact: 'Fix.',
        examples_compact: [
          { role: 'assistant' as const, content: 'Hi' },
          { role: 'user' as const, content: 'Yo' },
        ],
      }),
    });
    expect(minimal.llmEndpoint).toBe(custom);
  });
});
