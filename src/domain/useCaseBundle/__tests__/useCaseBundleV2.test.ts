import { describe, expect, it } from 'vitest';
import {
  parseAgentUseCaseBundleJson,
  serializeAgentUseCaseBundle,
  getBundleSchemaVersionFromRaw,
} from '../parseSerializeBundle';
import { USE_CASE_BUNDLE_SCHEMA_VERSION } from '../schema';
import { compileUseCasePhrases } from '../semanticCompile';
import { emptyProjectSlotLexicon } from '../projectSlotLexicon';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function minimalUc(content: string): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Scenario',
    dialogue: [
      { turn_id: 't1', role: 'assistant', content, editable: true },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('useCaseBundle v2', () => {
  it('migrates v1 array to v2 wrapper on serialize', () => {
    const raw = JSON.stringify([minimalUc('Una visita [cardiologica].')]);
    const parsed = parseAgentUseCaseBundleJson(raw);
    expect(parsed[0].phrases?.length).toBe(1);
    const out = serializeAgentUseCaseBundle(parsed);
    const obj = JSON.parse(out) as { useCaseBundleSchemaVersion: number; use_cases: unknown[] };
    expect(obj.useCaseBundleSchemaVersion).toBe(USE_CASE_BUNDLE_SCHEMA_VERSION);
    expect(getBundleSchemaVersionFromRaw(out)).toBe(2);
  });

  it('semantic compile maps cardiologica to prestazione', () => {
    const uc = minimalUc('Una visita [cardiologica]. Giusto?');
    const compiled = compileUseCasePhrases(uc, emptyProjectSlotLexicon());
    const tokenized =
      compiled.phrases?.[0]?.variants?.[0]?.compiled?.tokenizedText ?? '';
    expect(tokenized).toContain('[prestazione]');
    expect(tokenized).not.toContain('[cardiologica]');
  });
});
