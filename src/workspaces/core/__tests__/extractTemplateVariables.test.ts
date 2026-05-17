import { describe, expect, it } from 'vitest';
import { extractTemplateVariableNames } from '../extractTemplateVariables';

describe('extractTemplateVariableNames', () => {
  it('dedupes mustache names in order', () => {
    expect(
      extractTemplateVariableNames('Ciao {{dottore}} e {{agendaCodes}} — ancora {{dottore}}')
    ).toEqual(['dottore', 'agendaCodes']);
  });
});
