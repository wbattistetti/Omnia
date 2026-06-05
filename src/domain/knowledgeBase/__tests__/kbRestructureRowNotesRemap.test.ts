import { describe, expect, it } from 'vitest';
import { remapRestructureRowNotes, restructureRowKey } from '../kbDocumentRestructureWorkflow';

describe('remapRestructureRowNotes', () => {
  const headers = ['entity_id', 'label', 'visit_type'];
  const rows = [
    ['4', 'Visita A', 'unspecified'],
    ['6', 'Visita B', 'controllo'],
  ];

  it('keeps notes by entity_id after label change', () => {
    const notes = {
      [restructureRowKey(headers, rows[0]!, 0)]: 'nota su visita A',
      [restructureRowKey(headers, rows[1]!, 1)]: 'nota su visita B',
    };
    const nextRows = [
      ['4', 'Visita A rinominata', 'unspecified'],
      ['6', 'Visita B', 'controllo'],
    ];
    const remapped = remapRestructureRowNotes(headers, rows, headers, nextRows, notes);
    const key0 = restructureRowKey(headers, nextRows[0]!, 0);
    expect(remapped[key0]).toBe('nota su visita A');
  });
});
