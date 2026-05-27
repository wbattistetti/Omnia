import { describe, expect, it } from 'vitest';
import {
  documentExcerptMatchesSample,
  excerptDuplicatesDesignerNote,
  observationHeaderPreview,
  sanitizeDocumentExcerpt,
} from '../kbDocumentExcerptValidation';

describe('kbDocumentExcerptValidation', () => {
  const sample =
    'Il campo Codice Fiscale è obbligatorio per tutti i pazienti.\nLa prestazione deve essere registrata entro 24 ore.';

  it('accepts verbatim excerpt substring', () => {
    expect(documentExcerptMatchesSample('Codice Fiscale è obbligatorio', sample)).toBe(true);
    expect(sanitizeDocumentExcerpt('Codice Fiscale è obbligatorio', sample)).toBe(
      'Codice Fiscale è obbligatorio'
    );
  });

  it('rejects excerpt not in sample', () => {
    expect(documentExcerptMatchesSample('testo inventato dal modello', sample)).toBe(false);
    expect(sanitizeDocumentExcerpt('testo inventato dal modello', sample)).toBeUndefined();
  });

  it('detects excerpt that repeats the designer note', () => {
    expect(
      excerptDuplicatesDesignerNote(
        'Non va sempre chiesta?',
        'Non va sempre chiesta?'
      )
    ).toBe(true);
    expect(
      excerptDuplicatesDesignerNote('Il campo X è obbligatorio', 'Il campo X è obbligatorio?')
    ).toBe(false);
  });

  it('truncates long header preview with ellipsis', () => {
    const long = 'A'.repeat(150);
    expect(observationHeaderPreview(long, 120)).toHaveLength(120);
    expect(observationHeaderPreview(long, 120).endsWith('…')).toBe(true);
  });
});
