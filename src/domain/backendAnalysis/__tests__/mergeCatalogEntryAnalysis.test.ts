import { describe, expect, it } from 'vitest';
import {
  createEmptyBackendAnalysisDocumentV2,
  type BackendAnalysisDocumentV2,
} from '../backendAnalysisDocumentV2';
import {
  catalogEntryHasCompleteIaAnalysis,
  catalogEntryNeedsIaAnalysis,
  mergeCatalogEntryAnalysisFromMarkdown,
} from '../mergeCatalogEntryAnalysis';

describe('catalogEntryNeedsIaAnalysis', () => {
  it('needs run when only descriptionShort is filled', () => {
    const backend = {
      catalogEntryId: 'a',
      displayLabel: 'A',
      howToUseMarkdown: '',
      suggestedFeatures: [],
      parameters: {
        x: {
          paramKey: 'x',
          direction: 'input' as const,
          kind: 'required' as const,
          role: '',
          descriptionShort: 'solo tabella',
          analysisSummary: '',
          analysisDetailMarkdown: '',
        },
      },
    };
    expect(catalogEntryNeedsIaAnalysis(backend)).toBe(true);
    expect(catalogEntryHasCompleteIaAnalysis(backend)).toBe(false);
  });
});

describe('mergeCatalogEntryAnalysisFromMarkdown', () => {
  it('merges only the target catalog entry', () => {
    const current: BackendAnalysisDocumentV2 = {
      ...createEmptyBackendAnalysisDocumentV2(),
      backends: {
        a: {
          catalogEntryId: 'a',
          displayLabel: 'Alpha',
          howToUseMarkdown: 'keep alpha',
          suggestedFeatures: [],
          parameters: {
            x: {
              paramKey: 'x',
              direction: 'input',
              kind: 'required',
              role: 'old',
              descriptionShort: '',
              analysisSummary: '',
              analysisDetailMarkdown: '',
            },
          },
        },
        b: {
          catalogEntryId: 'b',
          displayLabel: 'Beta',
          howToUseMarkdown: 'unchanged beta',
          parameters: {},
          suggestedFeatures: [],
        },
      },
    };

    const markdown = `# Analisi backend

## Backend: Alpha [chip]
| Parametro | Direzione | Tipo | Ruolo | Descrizione |
| --- | --- | --- | --- | --- |
| x | → input | required | new role | short |

### PayoffData (per la UI)
\`\`\`json
{ "version": 1, "backend": "Alpha", "entries": [{ "parameter": "x", "payoffSummary": "sum", "payoffDetail": "detail" }] }
\`\`\`

## Backend: Other [chip]
| Parametro | Direzione | Tipo | Ruolo | Descrizione |
| --- | --- | --- | --- | --- |
| y | → input | required | ignore | x |
`;

    const merged = mergeCatalogEntryAnalysisFromMarkdown(
      current,
      markdown,
      'a',
      [
        {
          id: 'a',
          label: 'Alpha',
          endpointUrl: 'https://a',
          method: 'GET',
          creationMode: 'import',
          lastStructuralEditAt: '2020-01-01T00:00:00.000Z',
          frozenMeta: {
            lastImportedAt: '2020-01-01T00:00:00.000Z',
            specSourceUrl: 'https://a',
            contentHash: 'x',
            importState: 'ok',
          },
        },
      ],
      []
    );

    expect(merged.backends.a?.parameters.x?.role).toBe('new role');
    expect(merged.backends.a?.parameters.x?.analysisSummary).toBe('sum');
    expect(merged.backends.b?.howToUseMarkdown).toBe('unchanged beta');
    expect(merged.backends.Other).toBeUndefined();
  });

  it('matches backend section by URL slug when display label differs', () => {
    const current: BackendAnalysisDocumentV2 = {
      ...createEmptyBackendAnalysisDocumentV2(),
      backends: {
        'uuid-next': {
          catalogEntryId: 'uuid-next',
          displayLabel: 'next-window',
          howToUseMarkdown: '',
          suggestedFeatures: [],
          parameters: {
            days: {
              paramKey: 'days',
              direction: 'input',
              kind: 'required',
              role: '',
              descriptionShort: '',
              analysisSummary: '',
              analysisDetailMarkdown: '',
            },
          },
        },
      },
    };

    const markdown = `# Analisi backend

## Sintesi
- Usare per trovare il primo slot libero.

## Backend: agenda-solver/next-window [chip]
| Parametro | Direzione | Tipo | Ruolo | Descrizione |
| --- | --- | --- | --- | --- |
| days | → input | required | invio date | elenco giorni |

### PayoffData (per la UI)
\`\`\`json
{ "version": 1, "backend": "agenda-solver/next-window", "entries": [{ "parameter": "days", "payoffSummary": "date", "payoffDetail": "dettaglio" }] }
\`\`\`
`;

    const merged = mergeCatalogEntryAnalysisFromMarkdown(
      current,
      markdown,
      'uuid-next',
      [
        {
          id: 'uuid-next',
          label: 'next-window',
          endpointUrl:
            'https://example.supabase.co/functions/v1/agenda-solver/next-window',
          method: 'POST',
          creationMode: 'import',
          lastStructuralEditAt: '2020-01-01T00:00:00.000Z',
          frozenMeta: {
            lastImportedAt: '2020-01-01T00:00:00.000Z',
            specSourceUrl: 'https://example.supabase.co/functions/v1/agenda-solver/next-window',
            contentHash: 'x',
            importState: 'ok',
          },
        },
      ],
      []
    );

    expect(merged.backends['uuid-next']?.howToUseMarkdown).toContain('primo slot');
    expect(merged.backends['uuid-next']?.parameters.days?.role).toBe('invio date');
    expect(merged.backends['uuid-next']?.parameters.days?.analysisSummary).toBe('date');
  });
});
