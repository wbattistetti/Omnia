/**
 * Tests for runtime experiment JSON payload wrapper.
 */

import { describe, expect, it } from 'vitest';
import { buildRichRulesString } from '../composeRuntimeRulesFromCompact';
import {
  buildAiAgentRuntimeExperimentPayload,
  stringifyExperimentPayload,
} from '../aiAgentRuntimeExperimentJson';
import type { AIAgentRuntimeCompact } from '@types/aiAgentDesign';

const compactJson = JSON.stringify({
  behavior_compact: 'Do the thing.',
  constraints_compact: 'Must X.',
  sequence_compact: 'Step one.',
  corrections_compact: 'Fix and confirm.',
  examples_compact: [
    { role: 'assistant', content: 'Hi' },
    { role: 'user', content: 'Hey' },
  ],
});

describe('aiAgentRuntimeExperimentJson', () => {
  it('buildRichRulesString appends examples appendix', () => {
    const compact = JSON.parse(compactJson) as AIAgentRuntimeCompact;
    const r = buildRichRulesString('### Goal\n\nG', compact);
    expect(r).toContain('### Goal');
    expect(r).toContain('Style examples');
  });

  it('stringifyExperimentPayload is valid JSON', () => {
    const p = buildAiAgentRuntimeExperimentPayload('rules', { task: 't' }, []);
    const s = stringifyExperimentPayload(p);
    expect(JSON.parse(s).compileInput.rules).toBe('rules');
  });
});
