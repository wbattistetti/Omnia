import { describe, expect, it } from 'vitest';
import { buildDesignerSpecBrief } from '../buildDesignerSpecBrief';

describe('buildDesignerSpecBrief', () => {
  it('includes observation and interpretation', () => {
    const text = buildDesignerSpecBrief({
      id: 'A',
      kind: 'aggiunta',
      presentation: 'domanda',
      text: 'Vincoli utente su giorni',
      interpretation: 'Serve estensione su days',
    });
    expect(text).toContain('Vincoli utente');
    expect(text).toContain('Serve estensione');
    expect(text).toContain('formalizzare');
  });
});
