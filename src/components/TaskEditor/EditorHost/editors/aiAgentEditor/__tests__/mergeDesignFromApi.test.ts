/**
 * Tests for pure mapping from LLM design payload to editor fragments.
 */

import { describe, expect, it } from 'vitest';
import {
  applyGenerateDesignPayload,
  extendOutputMappingsForNewSlotIds,
  proposedFieldsFromDesignPayload,
} from '../mergeDesignFromApi';
import type { AIAgentDesignPayload } from '@types/aiAgentDesign';

const minimalDesign = (): AIAgentDesignPayload => ({
  proposed_variables: [
    { field_name: 'user_name', label: 'Nome', type: 'text', required: true },
  ],
  initial_state_template: { task_completed: false },
  goal: 'Collect and confirm user name.',
  operational_sequence: 'Greet, ask name, confirm.',
  context: '',
  constraints: 'Must:\n\nAsk before saving.\n\nMust not:\n\nStore without consent.',
  personality: 'Helpful assistant.',
  tone: 'Tone: neutral\n\nBrief and clear.',
  agent_prompt: '### Goal\n\nCollect...',
  sample_dialogue: [
    { role: 'assistant', content: 'Hi' },
    { role: 'user', content: 'Hello' },
  ],
  design_notes: 'note',
  runtime_compact: {
    behavior_compact: 'Collect user name and confirm.',
    constraints_compact: 'Must ask before storing.',
    sequence_compact: 'Greet ask confirm save.',
    corrections_compact: 'On change reconfirm.',
    examples_compact: [
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'Hello' },
    ],
  },
});

describe('mergeDesignFromApi', () => {
  it('normalizes entity types on proposed fields', () => {
    const d = minimalDesign();
    d.proposed_variables[0].type = 'String';
    const fields = proposedFieldsFromDesignPayload(d);
    expect(fields[0].type).toBe('text');
  });

  it('extends mappings only for missing slot ids', () => {
    const prev = { existing: 'x' };
    const next = extendOutputMappingsForNewSlotIds(prev, ['existing', 'new_slot']);
    expect(next.existing).toBe('x');
    expect(next.new_slot).toBe('');
  });

  it('applyGenerateDesignPayload merges mapping keys from slotIds', () => {
    const applied = applyGenerateDesignPayload(minimalDesign());
    const slotId = applied.proposedFields[0].slotId;
    const merged = applied.mergeOutputMappings({ other: 'y' });
    expect(merged.other).toBe('y');
    expect(merged[slotId]).toBe('');
  });

  it('applyGenerateDesignPayload serializes runtime_compact for persistence', () => {
    const applied = applyGenerateDesignPayload(minimalDesign());
    expect(JSON.parse(applied.agentRuntimeCompactJson).behavior_compact).toContain('Collect');
  });
});
