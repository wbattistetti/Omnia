import { describe, expect, it } from 'vitest';
import {
  documentExcerptMatchesSample,
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

  it('truncates long header preview with ellipsis', () => {
    const long = 'A'.repeat(150);
    expect(observationHeaderPreview(long, 120)).toHaveLength(120);
    expect(observationHeaderPreview(long, 120).endsWith('…')).toBe(true);
  });
});
