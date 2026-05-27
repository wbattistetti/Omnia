import { describe, expect, it } from 'vitest';
import { collectBackendAnalysisStructureContext } from '../collectBackendAnalysisStructureContext';
import { parseBackendAnalysisDocument } from '../parseBackendAnalysisDocument';
import { renderBackendAnalysisDocument } from '../renderBackendAnalysisDocument';
import { structureBackendAnalysis } from '../structureBackendAnalysis';

describe('structureBackendAnalysis', () => {
  it('structures flat legacy table into per-backend sections with PayoffData', () => {
    const raw = `
## Sintesi
- Identificare prestazione e prenotare slot.

## Parametri e backend
| Parametro | Backend | Ruolo | Motivazione |
| serviceId | BookFromAgenda | input | obbligatorio da KB prestazioni |
| patientId | BookFromAgenda | input | chiesto all utente in dialogo |
| slotId | BookFromAgenda | output | risposta API backend |

## Note
- Manca backend GetSlotDetails per dettaglio slot.
- La KB contiene esami associati ma non distingue obbligatori e opzionali.
`;

    const result = structureBackendAnalysis({
      rawText: raw,
      context: {
        knownBackends: [{ id: '1', label: 'BookFromAgenda' }],
        knownParameters: [
          { name: 'serviceId', backendLabel: 'BookFromAgenda', direction: 'input' },
          { name: 'patientId', backendLabel: 'BookFromAgenda', direction: 'input' },
          { name: 'slotId', backendLabel: 'BookFromAgenda', direction: 'output' },
        ],
      },
    });

    expect(result.markdown).toMatch(/^# Analisi backend/m);
    expect(result.markdown).toContain('## Backend: BookFromAgenda [chip]');
    expect(result.markdown).toContain('| [serviceId] |');
    expect(result.markdown).toContain('### PayoffData (per la UI)');
    expect(result.markdown).toContain('"payoffSummary"');
    expect(result.markdown).toContain('## Tagging sintetico per Monaco');
    expect(result.markdown).toContain('[param:serviceId|required]');
    expect(result.markdown).toContain('## System Prompt sintetico');
    expect(result.document.backends).toHaveLength(1);
    expect(result.document.backends[0].payoffData.entries.length).toBeGreaterThan(0);
    expect(result.document.missingBackends.some((b) => /getslotdetails/i.test(b.name))).toBe(
      true
    );
  });

  it('round-trips parse and render', () => {
    const { document, markdown } = structureBackendAnalysis({
      rawText: '## Sintesi\n- Test.\n\n| Parametro | Backend | Ruolo | Motivazione |\n| foo | Bar | input | note |',
      context: {
        knownBackends: [{ id: '1', label: 'Bar' }],
        knownParameters: [{ name: 'foo', backendLabel: 'Bar', direction: 'input' }],
      },
    });
    const parsed = parseBackendAnalysisDocument(markdown);
    expect(parsed).not.toBeNull();
    expect(parsed!.backends[0].parameters[0].name).toBe('foo');
    expect(renderBackendAnalysisDocument(document)).toBe(markdown);
  });

  it('does not invent parameters absent from text when catalog is provided', () => {
    const result = structureBackendAnalysis({
      rawText: '## Sintesi\n- Solo testo generico senza nomi campo.',
      context: {
        knownBackends: [{ id: 'x', label: 'OnlyBackend' }],
        knownParameters: [
          { name: 'secretField', backendLabel: 'OnlyBackend', direction: 'input' },
        ],
      },
    });
    expect(
      result.document.backends.flatMap((b) => b.parameters).find((p) => p.name === 'secretField')
    ).toBeUndefined();
  });

  it('preserves param tags from source', () => {
    const result = structureBackendAnalysis({
      rawText: '## Sintesi\n- Breve.\n\n[param:customId|derived]\n',
    });
    expect(result.document.monacoTags.some((t) => t.name === 'customId' && t.kind === 'derived')).toBe(
      true
    );
  });
});

describe('collectBackendAnalysisStructureContext', () => {
  it('returns empty lists without catalog entries', () => {
    const ctx = collectBackendAnalysisStructureContext([], []);
    expect(ctx.knownBackends).toEqual([]);
    expect(ctx.knownParameters).toEqual([]);
  });
});
