import { describe, expect, it } from 'vitest';
import { generateKbDialogUseCasesFromDocument } from '../generateKbDialogFromDocument';
import type { StagedKbDocument } from '../../kbDocumentTypes';
import { inferSelectorSpecFromGrid } from '../../kbSelectorSpec';

const pipeTableMarkdown = [
  '## Dati normalizzati',
  '',
  'Tabella prestazioni prenotabili per dialogo deterministico agente PAROS (fixture test).',
  '',
  '| specialita | tipo_visita | esame_associato |',
  '| --- | --- | --- |',
  '| cardiologia | prima_visita | nessuno |',
  '| cardiologia | controllo | ecg |',
  '| radiologia | prima_visita | nessuno |',
].join('\n');

function makeDoc(overrides: Partial<StagedKbDocument> = {}): StagedKbDocument {
  const grid = {
    headers: ['specialita', 'tipo_visita', 'esame_associato'],
    rows: [
      ['cardiologia', 'prima_visita', 'nessuno'],
      ['cardiologia', 'controllo', 'ecg'],
    ],
  };
  return {
    id: 'doc-test',
    name: 'test.xlsx',
    parseStatus: 'ready',
    documentRestructuredApprovedForRuntime: true,
    documentRestructuredMarkdown: pipeTableMarkdown,
    documentSelectorSpec: inferSelectorSpecFromGrid(grid),
    ...overrides,
  } as StagedKbDocument;
}

describe('generateKbDialogUseCasesFromDocument', () => {
  it('parses markdown pipe table wrapper from restructured KB document', () => {
    const gen = generateKbDialogUseCasesFromDocument(makeDoc());
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.result.useCases.length).toBeGreaterThan(0);
    expect(gen.result.categories.length).toBe(4);
  });

  it('returns kb_restructure_missing when restructured content is too short', () => {
    const gen = generateKbDialogUseCasesFromDocument(
      makeDoc({ documentRestructuredMarkdown: 'solo testo libero senza tabella' })
    );
    expect(gen.ok).toBe(false);
    if (gen.ok) return;
    expect(gen.error).toBe('kb_restructure_missing');
  });
});
