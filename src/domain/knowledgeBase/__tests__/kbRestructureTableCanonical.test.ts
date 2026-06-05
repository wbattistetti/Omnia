import { describe, expect, it } from 'vitest';
import {
  canonicalizeRestructureCell,
  canonicalizeRestructureHeader,
  canonicalizeRestructuredGrid,
  canonicalizeRestructuredTableMarkdown,
} from '../kbRestructureTableCanonical';

describe('canonicalizeRestructureHeader', () => {
  it('maps English headers to Italian', () => {
    expect(canonicalizeRestructureHeader('code')).toBe('codice');
    expect(canonicalizeRestructureHeader('specialty')).toBe('specialita');
    expect(canonicalizeRestructureHeader('visit_type')).toBe('tipo_visita');
    expect(canonicalizeRestructureHeader('exam_status')).toBe('esame_obbligatorio');
  });
});

describe('canonicalizeRestructureCell', () => {
  it('maps not_applicable and unknown to dash', () => {
    expect(canonicalizeRestructureCell('esame_obbligatorio', 'not_applicable')).toBe('-');
    expect(canonicalizeRestructureCell('fascia_eta', 'unknown')).toBe('-');
  });

  it('maps visit_type enums to Italian', () => {
    expect(canonicalizeRestructureCell('tipo_visita', 'unspecified')).toBe('non_specificato');
    expect(canonicalizeRestructureCell('tipo_visita', 'controllo')).toBe('controllo');
  });
});

describe('canonicalizeRestructuredTableMarkdown', () => {
  it('rewrites pipe table headers in markdown', () => {
    const md = `## Dati normalizzati

| code | label | specialty | visit_type | associated_exam | exam_status |
| --- | --- | --- | --- | --- | --- |
| 12 | Visita test | pneumologia | unspecified | - | not_applicable |`;

    const out = canonicalizeRestructuredTableMarkdown(md);
    expect(out).toContain('| codice | etichetta | specialita | tipo_visita | esame_associato | esame_obbligatorio |');
    expect(out).toContain('non_specificato');
    expect(out).not.toContain('not_applicable');
    expect(out).not.toContain('unspecified');
  });
});

describe('canonicalizeRestructuredGrid', () => {
  it('preserves row count', () => {
    const grid = canonicalizeRestructuredGrid({
      headers: ['code', 'specialty'],
      rows: [['1', 'cardio']],
    });
    expect(grid.headers).toEqual(['codice', 'specialita']);
    expect(grid.rows[0]).toEqual(['1', 'cardio']);
  });
});
