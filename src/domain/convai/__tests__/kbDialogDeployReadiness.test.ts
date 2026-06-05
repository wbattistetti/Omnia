import { describe, expect, it } from 'vitest';
import {
  collectKbDialogDeployIssues,
  isKbDialogDeployReady,
} from '../kbDialogDeployReadiness';

const APPROVED_DOC = {
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
    schemaVersion: 1 as const,
    columns: [
      {
        columnId: 'specialita',
        headerLabel: 'specialita',
        role: 'selector' as const,
        promptType: 'closed_list' as const,
        sortOrder: 0,
        promptTemplate: 'la specialità',
        askPolicy: 'required' as const,
      },
    ],
    invalidationTemplates: [],
  },
};

describe('kbDialogDeployReadiness', () => {
  it('reports missing KB', () => {
    expect(isKbDialogDeployReady('[]')).toBe(false);
    expect(collectKbDialogDeployIssues('[]')[0]?.code).toBe('kb_missing');
  });

  it('is ready when doc approved with selectorSpec', () => {
    const json = JSON.stringify([APPROVED_DOC]);
    expect(isKbDialogDeployReady(json)).toBe(true);
    expect(collectKbDialogDeployIssues(json)).toEqual([]);
  });

  it('reports not approved', () => {
    const json = JSON.stringify([
      { ...APPROVED_DOC, documentRestructuredApprovedForRuntime: false },
    ]);
    expect(isKbDialogDeployReady(json)).toBe(false);
    expect(collectKbDialogDeployIssues(json).some((i) => i.code === 'kb_not_approved')).toBe(true);
  });
});
