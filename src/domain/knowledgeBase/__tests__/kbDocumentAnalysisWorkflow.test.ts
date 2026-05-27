import { describe, expect, it } from 'vitest';
import {
  allReviewItemsConfirmed,
  analysisDraftDiffersFromBaseline,
  createReviewSessionItems,
  inferObservationPresentation,
  observationPresentationChipLabel,
  normalizeAnalysisText,
  parseKbAnalysisObservationReview,
  resolveKbAnalysisToolbarPresentation,
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

  it('maps presentation to chip labels', () => {
    expect(observationPresentationChipLabel('domanda')).toBe('Domanda');
    expect(observationPresentationChipLabel('osservazione')).toBe('Osservazione');
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

  it('strips excerpt that duplicates the designer note even if in sample', () => {
    const sample = 'Non va sempre chiesta? Altro testo nel baseline.';
    const parsed = parseKbAnalysisObservationReview(
      {
        observations: [
          {
            id: 'A',
            kind: 'aggiunta',
            presentation: 'domanda',
            text: 'Non va sempre chiesta?',
            interpretation: '- Meglio verificare prima nella KB.',
            documentExcerpt: 'Non va sempre chiesta?',
          },
        ],
      },
      sample
    );
    expect(parsed.observations[0]?.documentExcerpt).toBeUndefined();
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

describe('resolveKbAnalysisToolbarPresentation', () => {
  const base = {
    canRunAgent: true,
    inReviewSession: false,
    allConfirmed: false,
    reviewHasDisagreement: false,
  };

  it('hides action before manual edit (guide / AI-only text)', () => {
    expect(
      resolveKbAnalysisToolbarPresentation({
        ...base,
        baseline: '',
        draft: '',
        hasManualEdit: false,
      })
    ).toMatchObject({ executeVisible: false });

    expect(
      resolveKbAnalysisToolbarPresentation({
        ...base,
        baseline: 'analisi agente',
        draft: 'analisi agente',
        hasManualEdit: false,
      })
    ).toMatchObject({ executeVisible: false, phase: 'hidden' });
  });

  it('shows Esegui on first manual trace before any agent baseline', () => {
    expect(
      resolveKbAnalysisToolbarPresentation({
        ...base,
        baseline: '',
        draft: 'mia traccia',
        hasManualEdit: true,
      })
    ).toMatchObject({
      executeVisible: true,
      executeLabel: 'Esegui',
      phase: 'request_review',
      executeEnabled: true,
      executeEmphasized: true,
    });
  });

  it('shows Aggiorna after first analysis when user edits again', () => {
    expect(
      resolveKbAnalysisToolbarPresentation({
        ...base,
        baseline: 'v1 agente',
        draft: 'v1 agente con modifica utente',
        hasManualEdit: true,
      })
    ).toMatchObject({
      executeVisible: true,
      executeLabel: 'Rivedi modifiche',
      phase: 'request_review',
      executeEnabled: true,
      executeEmphasized: true,
    });
  });

  it('shows Review osservazioni during review; Aggiorna only when all confirmed', () => {
    const pending = resolveKbAnalysisToolbarPresentation({
      ...base,
      baseline: 'v1',
      draft: 'v1 edit',
      hasManualEdit: true,
      inReviewSession: true,
      allConfirmed: false,
    });
    expect(pending).toMatchObject({
      executeVisible: true,
      executeLabel: 'Review osservazioni',
      phase: 'review_observations',
      executeEnabled: false,
    });

    const done = resolveKbAnalysisToolbarPresentation({
      ...base,
      baseline: 'v1',
      draft: 'v1 edit',
      hasManualEdit: true,
      inReviewSession: true,
      allConfirmed: true,
    });
    expect(done).toMatchObject({
      executeLabel: 'Aggiorna',
      phase: 'apply_update',
      executeEnabled: true,
      executeEmphasized: true,
    });
  });
});
