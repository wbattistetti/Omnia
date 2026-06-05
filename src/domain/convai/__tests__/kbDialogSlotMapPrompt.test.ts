import { describe, expect, it } from 'vitest';
import { buildKbDialogSlotMapPromptSection } from '../kbDialogSlotMapPrompt';

describe('buildKbDialogSlotMapPromptSection', () => {
  it('returns empty when no approved KB', () => {
    expect(buildKbDialogSlotMapPromptSection('[]')).toBe('');
  });

  it('lists selector keys from approved document', () => {
    const json = JSON.stringify([
      {
        id: 'doc-1',
        name: 'PAROS',
        parseStatus: 'ready',
        mimeType: 'text/plain',
        documentRestructuredApprovedForRuntime: true,
        documentRestructuredMarkdown: `## Dati normalizzati

| specialita | tipo_visita |
| --- | --- |
| Cardiologia | Prima visita |
| Ortopedia | Visita di controllo |
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
            {
              columnId: 'tipo_visita',
              headerLabel: 'tipo_visita',
              role: 'selector',
              promptType: 'closed_list',
              sortOrder: 1,
              promptTemplate: 'il tipo di visita',
              askPolicy: 'required',
            },
          ],
          invalidationTemplates: [],
        },
      },
    ]);
    const section = buildKbDialogSlotMapPromptSection(json);
    expect(section).toContain('`specialita`');
    expect(section).toContain('`tipo_visita`');
    expect(section).toContain('updates');
  });
});
