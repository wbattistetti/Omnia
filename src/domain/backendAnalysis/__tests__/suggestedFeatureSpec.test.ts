import { describe, expect, it } from 'vitest';
import {
  buildSuggestedFeatureFromApiPayload,
  syncSuggestedFeatureRecord,
} from '../suggestedFeatureSpec';

describe('suggestedFeatureSpec', () => {
  it('builds and syncs from API payload', () => {
    const feature = buildSuggestedFeatureFromApiPayload(
      {
        title: 'Vincoli slot',
        purposeMarkdown: 'Filtrare disponibilità per giorni e fasce.',
        parameters: [
          {
            paramKey: 'constraints.excludeWeekdays',
            direction: 'input',
            kind: 'optional',
            dataType: 'string[]',
            role: 'Giorni esclusi',
            descriptionShort: 'Giorni non prenotabili',
          },
        ],
      },
      'obs-A'
    );
    expect(feature).not.toBeNull();
    expect(feature!.title).toBe('Vincoli slot');
    expect(feature!.sourceObservationId).toBe('obs-A');
    expect(Object.keys(feature!.parameters)).toContain('constraints.excludeWeekdays');

    const synced = syncSuggestedFeatureRecord(feature!);
    expect(synced.specMarkdown).toMatch(/Vincoli slot/);
    expect(synced.specMarkdown).toMatch(/constraints\.excludeWeekdays/);
  });
});
