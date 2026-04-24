import { describe, it, expect } from 'vitest';
import {
  applyStructuredIrToGenerateApplyResult,
  buildDeterministicRuntimeCompactFromSectionBases,
} from '../applyExtractStructureIr';

describe('applyExtractStructureIr', () => {
  it('applyStructuredIrToGenerateApplyResult maps constraints and builds markdown', () => {
    const applied = applyStructuredIrToGenerateApplyResult({
      goal: 'Greet the user.',
      operational_sequence: 'Step one.\nStep two.',
      context: 'missing',
      constraints: { must: 'Be polite.', must_not: 'Lie.' },
      personality: 'Friendly.',
      tone: 'Brief.',
    });
    expect(applied.sectionBases.goal).toBe('Greet the user.');
    expect(applied.sectionBases.constraints).toContain('Must:');
    expect(applied.sectionBases.constraints).toContain('Must not:');
    expect(applied.agentPrompt).toContain('Greet');
    const rc = JSON.parse(applied.agentRuntimeCompactJson);
    expect(rc.behavior_compact).toBeTruthy();
    expect(rc.examples_compact).toHaveLength(2);
  });

  it('buildDeterministicRuntimeCompactFromSectionBases respects word caps', () => {
    const long = Array.from({ length: 50 }, () => 'word').join(' ');
    const rc = buildDeterministicRuntimeCompactFromSectionBases({
      goal: long,
      operational_sequence: long,
      context: '',
      constraints: long,
      personality: long,
      tone: long,
      examples: '',
    });
    expect(rc.sequence_compact.split(/\s+/).length).toBeLessThanOrEqual(32);
    expect(rc.constraints_compact.split(/\s+/).length).toBeLessThanOrEqual(28);
  });
});
