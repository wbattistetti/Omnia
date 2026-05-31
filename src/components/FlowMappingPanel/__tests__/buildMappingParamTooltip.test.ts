import { describe, expect, it } from 'vitest';
import { createMappingEntry } from '../mappingTypes';
import { buildMappingParamTooltip } from '../buildMappingParamTooltip';

describe('buildMappingParamTooltip', () => {
  it('include tipo e descrizione', () => {
    const tip = buildMappingParamTooltip(
      createMappingEntry({
        wireKey: 'allowedWeekdays',
        openapiFormatLabel: 'array · integer',
        fieldDescription: 'Giorni ammessi 0-6',
      })
    );
    expect(tip).toContain('Tipo: array · integer');
    expect(tip).toContain('Giorni ammessi 0-6');
  });

  it('schema-only aggiunge nota firma', () => {
    const tip = buildMappingParamTooltip(
      createMappingEntry({
        wireKey: 'constraints.allowedMonths',
        schemaOutlineOnly: true,
        openapiFormatLabel: 'array · integer',
      })
    );
    expect(tip).toContain('non mappata sul task');
  });
});
