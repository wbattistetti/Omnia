import { describe, expect, it } from 'vitest';
import {
  allReviewItemsConfirmed,
  analysisDraftDiffersFromBaseline,
  createReviewSessionItems,
  inferObservationPresentation,
  normalizeAnalysisText,
  parseKbAnalysisObservationReview,
  shouldRunObservationReview,
} from '../kbDocumentAnalysisWorkflow';

describe('kbDocumentAnalysisWorkflow', () => {
  it('normalizes line endings and trims', () => {
    expect(normalizeAnalysisText('  a\r\nb  ')).toBe('a\nb');
  });

  it('detects diff only when baseline is non-empty and differs', () => {
    expect(analysisDraftDiffersFromBaseline('b', 'a')).toBe(true);
    expect(analysisDraftDiffersFromBaseline('same', 'same')).toBe(false);
    expect(analysisDraftDiffersFromBaseline('x', '')).toBe(false);
    expect(shouldRunObservationReview('', 'user draft')).toBe(false);
    expect(shouldRunObservationReview('agent', 'user draft')).toBe(true);
  });

  it('infers domanda vs osservazione', () => {
    expect(inferObservationPresentation('aggiunta', 'Qual è il campo X?')).toBe('domanda');
    expect(inferObservationPresentation('correzione', 'Il campo X è obbligatorio')).toBe(
      'osservazione'
    );
  });

  it('parses observation review with validated document excerpt', () => {
    const sample = 'Il campo X è obbligatorio per tutti i pazienti.';
    const parsed = parseKbAnalysisObservationReview(
      {
        observations: [
          {
            id: 'A',
            kind: 'aggiunta',
            text: 'Il campo X è obbligatorio?',
            interpretation: 'Capisco che X è richiesto.',
            documentExcerpt: 'Il campo X è obbligatorio',
            excerptRationale: 'Il testo cita esplicitamente l\'obbligatorietà.',
          },
        ],
      },
      sample
    );
    expect(parsed.observations[0]?.documentExcerpt).toBe('Il campo X è obbligatorio');
    expect(parsed.observations[0]?.excerptRationale).toContain('obbligatorietà');
  });

  it('strips excerpt that does not match sample', () => {
    const parsed = parseKbAnalysisObservationReview(
      {
        observations: [
          {
            id: 'A',
            kind: 'correzione',
            text: 'punto',
            interpretation: 'risposta',
            documentExcerpt: 'citazione inventata',
          },
        ],
      },
      'testo reale del documento'
    );
    expect(parsed.observations[0]?.documentExcerpt).toBeUndefined();
  });

  it('parses observation review payload without summaryMarkdown', () => {
    const parsed = parseKbAnalysisObservationReview({
      observations: [
        {
          id: 'A',
          kind: 'aggiunta',
          presentation: 'domanda',
          text: 'Gli esami hanno prestazione obbligatoria?',
          interpretation: 'Capisco che vuoi chiarire l\'obbligatorietà della prestazione.',
        },
      ],
    });
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.observations[0]?.presentation).toBe('domanda');
  });

  it('tracks per-item confirmation for finalize gate', () => {
    const review = parseKbAnalysisObservationReview({
      observations: [
        {
          id: 'A',
          kind: 'aggiunta',
          text: 'punto uno',
          interpretation: 'risposta uno',
        },
        {
          id: 'B',
          kind: 'precisazione',
          text: 'punto due',
          interpretation: 'risposta due',
        },
      ],
    });
    const items = createReviewSessionItems(review);
    expect(allReviewItemsConfirmed(items)).toBe(false);
    items[0]!.status = 'confirmed';
    expect(allReviewItemsConfirmed(items)).toBe(false);
    items[1]!.status = 'confirmed';
    expect(allReviewItemsConfirmed(items)).toBe(true);
  });
});
