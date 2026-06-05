import { describe, expect, it } from 'vitest';
import {
  compileKbDeterministicAgentPrompt,
  OMNIA_DIALOG_STEP_PROMPT_APPEND,
} from '../compileKbDeterministicAgentPrompt';

const APPROVED_KB_JSON = JSON.stringify([
  {
    id: 'doc-1',
    name: 'PAROS',
    parseStatus: 'ready',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    documentRestructuredApprovedForRuntime: true,
    documentRestructuredMarkdown: `## Dati normalizzati

| specialita | tipo_visita |
| --- | --- |
| Cardiologia | Prima visita |
`,
    documentSelectorSpec: {
      schemaVersion: 1,
      columns: [
        {
          columnId: 'specialita',
          headerLabel: 'specialita',
          role: 'selector',
          promptType: 'closed_list',
          sortOrder: 0,
          promptTemplate: 'la specialità',
          askPolicy: 'required',
        },
      ],
      invalidationTemplates: [],
    },
  },
]);

describe('compileKbDeterministicAgentPrompt', () => {
  it('includes OMNIA_DIALOG_STEP, slot map, omits operational sequence and UC catalog', () => {
    const prompt = compileKbDeterministicAgentPrompt({
      id: 'agent-1',
      agentPrompt: '',
      agentKnowledgeBaseDocumentsJson: APPROVED_KB_JSON,
      agentStructuredSectionsJson: JSON.stringify({
        schemaVersion: 1,
        sections: {
          goal: { base: 'Accogliere il paziente.', deletedMask: '', inserts: [] },
          operational_sequence: {
            base: 'Chiedere specialità e tipo visita in sequenza.',
            deletedMask: '',
            inserts: [],
          },
          context: { base: 'Clinica privata.', deletedMask: '', inserts: [] },
          constraints: { base: 'Non mentire.', deletedMask: '', inserts: [] },
          personality: { base: 'Cortese.', deletedMask: '', inserts: [] },
          tone: { base: 'Professionale.', deletedMask: '', inserts: [] },
          examples: { base: '', deletedMask: '', inserts: [] },
        },
        backendPlaceholders: [],
      }),
      agentIaRuntimeOverrideJson: '',
    });
    expect(prompt).toContain('OMNIA_DIALOG_STEP');
    expect(prompt).toContain(OMNIA_DIALOG_STEP_PROMPT_APPEND.slice(0, 40));
    expect(prompt).toContain('Slot NLU');
    expect(prompt).toContain('`specialita`');
    expect(prompt).not.toContain('Operational sequence');
    expect(prompt).not.toContain('Chiedere specialità e tipo visita');
    expect(prompt).not.toContain('Template-Only');
    expect(prompt).not.toContain('USECASE:');
    expect(prompt).not.toContain('Non mentire');
  });
});
