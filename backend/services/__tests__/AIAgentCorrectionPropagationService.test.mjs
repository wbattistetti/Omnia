// Unit tests for the directional propagation service. Cover the two pure helpers
// (input normalization + prompt builder); the LLM round-trip is exercised end-to-end
// elsewhere — here we lock the prompt SHAPE so accidental edits don't silently change
// the model's instruction set.
//
// Run: `npx vitest run backend/services/__tests__/AIAgentCorrectionPropagationService.test.mjs`

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildPropagateCorrectionUserMessage,
  normalizeDirectionalInputs,
  PROPAGATE_CORRECTION_SYSTEM,
} = require('../AIAgentCorrectionPropagationService.js');

describe('normalizeDirectionalInputs', () => {
  it('throws when examples or targets are missing/empty', () => {
    expect(() => normalizeDirectionalInputs(null, [{ useCaseId: 't1', original: 'x' }])).toThrow(
      /directionalExamples/
    );
    expect(() =>
      normalizeDirectionalInputs(
        [{ useCaseId: 'e1', original: 'a', modified: 'b' }],
        []
      )
    ).toThrow(/directionalTargets/);
  });

  it('rejects examples missing original or modified', () => {
    expect(() =>
      normalizeDirectionalInputs(
        [{ useCaseId: 'e1', original: 'a' }],
        [{ useCaseId: 't1', original: 'x' }]
      )
    ).toThrow(/non-empty original AND modified/);
  });

  it('rejects duplicate target ids (would clash on the order/output map)', () => {
    expect(() =>
      normalizeDirectionalInputs(
        [{ useCaseId: 'e1', original: 'a', modified: 'b' }],
        [
          { useCaseId: 't1', original: 'x' },
          { useCaseId: 't1', original: 'y' },
        ]
      )
    ).toThrow(/duplicate useCaseId/);
  });

  it('clamps long fields to the defensive cap', () => {
    const long = 'a'.repeat(5000);
    const { examples, targets } = normalizeDirectionalInputs(
      [{ useCaseId: 'e1', original: long, modified: long }],
      [{ useCaseId: 't1', original: long }]
    );
    expect(examples[0].original.length).toBeLessThanOrEqual(2000);
    expect(examples[0].modified.length).toBeLessThanOrEqual(2000);
    expect(targets[0].original.length).toBeLessThanOrEqual(2000);
  });

  it('accepts both camelCase and snake_case keys', () => {
    const { examples, targets } = normalizeDirectionalInputs(
      [
        {
          use_case_id: 'e1',
          use_case_label: 'Booking',
          original: 'foo',
          modified: 'bar',
        },
      ],
      [{ use_case_id: 't1', use_case_label: 'Cancel', original: 'baz' }]
    );
    expect(examples[0].useCaseId).toBe('e1');
    expect(examples[0].useCaseLabel).toBe('Booking');
    expect(targets[0].useCaseId).toBe('t1');
  });
});

describe('buildPropagateCorrectionUserMessage', () => {
  const examples = [
    { useCaseId: 'e1', useCaseLabel: 'Booking', original: 'Ciao!', modified: 'Salve.' },
  ];
  const targets = [{ useCaseId: 't1', useCaseLabel: 'Cancel', original: 'Yo, dimmi.' }];

  it('embeds DIRECTIONAL_EXAMPLES + TARGETS + TARGET_IDS_ORDER blocks', () => {
    const msg = buildPropagateCorrectionUserMessage('it-IT', examples, targets, '', ['t1']);
    expect(msg).toContain('OUTPUT_LANGUAGE (BCP 47): it-IT');
    expect(msg).toContain('DIRECTIONAL_EXAMPLES');
    expect(msg).toContain('"useCaseId":"e1"');
    expect(msg).toContain('TARGETS');
    expect(msg).toContain('"useCaseId":"t1"');
    expect(msg).toContain('TARGET_IDS_ORDER');
    expect(msg).toContain('["t1"]');
  });

  it('emits the single-target hint when exactly one target is requested', () => {
    const msg = buildPropagateCorrectionUserMessage('it-IT', examples, targets, '', ['t1']);
    expect(msg).toContain('exactly one target id');
    expect(msg).toContain('exactly one object');
  });

  it('skips OUTPUT_LANGUAGE line when language is empty', () => {
    const msg = buildPropagateCorrectionUserMessage('', examples, targets, '', ['t1']);
    expect(msg.startsWith('DIRECTIONAL_EXAMPLES')).toBe(true);
  });

  it('inlines GLOBAL_STYLE_CONTRACT when provided', () => {
    const msg = buildPropagateCorrectionUserMessage(
      'it-IT',
      examples,
      targets,
      'Always be polite.',
      ['t1']
    );
    expect(msg).toContain('GLOBAL_STYLE_CONTRACT:');
    expect(msg).toContain('Always be polite.');
  });
});

describe('PROPAGATE_CORRECTION_SYSTEM', () => {
  it('mentions DIRECTIONAL_EXAMPLES, TARGETS and the JSON shape contract', () => {
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/DIRECTIONAL_EXAMPLES/);
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/TARGETS/);
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/use_case_id/);
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/new_assistant_content/);
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/is_new/);
    expect(PROPAGATE_CORRECTION_SYSTEM).toMatch(/style_synthesis/);
  });
});
