import { describe, expect, it } from 'vitest';
import { parseKbAnalysisObservationReview } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  materializeObservationSuggestedFeature,
  observationSuggestsApiExtension,
} from '../backendAnalysisObservationExtensions';

describe('backendAnalysisObservationExtensions', () => {
  it('parses review observation with suggestedFeature draft', () => {
    const review = parseKbAnalysisObservationReview({
      observations: [
        {
          id: 'A',
          kind: 'aggiunta',
          presentation: 'domanda',
          text: 'Vincoli su days',
          interpretation: 'Serve estensione',
          suggestsApiExtension: true,
          suggestedFeature: {
            title: 'Vincoli slot',
            purposeMarkdown: 'Filtrare giorni e fasce.',
            parameters: [
              {
                paramKey: 'constraints.excludeWeekdays',
                direction: 'input',
                kind: 'optional',
                dataType: 'string[]',
                role: 'Esclusioni',
                descriptionShort: 'Giorni non prenotabili',
              },
            ],
          },
        },
      ],
    });

    const obs = review.observations[0]!;
    expect(observationSuggestsApiExtension(obs)).toBe(true);
    const feature = materializeObservationSuggestedFeature(obs);
    expect(feature?.title).toBe('Vincoli slot');
    expect(feature?.parameters['constraints.excludeWeekdays']?.paramKey).toBe(
      'constraints.excludeWeekdays'
    );
  });
});
