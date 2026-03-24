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
  behavior_spec: 'Main behavior.',
  positive_constraints: 'Do X.',
  negative_constraints: 'Avoid Y.',
  operational_sequence: 'Step 1 then 2.',
  correction_rules: 'On fix, reconfirm.',
  conversational_state: '',
  agent_prompt: '## Behavior Spec\n\nMain behavior.',
  sample_dialogue: [
    { role: 'assistant', content: 'Hi' },
    { role: 'user', content: 'Hello' },
  ],
  design_notes: 'note',
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
});
