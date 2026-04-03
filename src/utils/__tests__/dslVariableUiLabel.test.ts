import { describe, expect, it } from 'vitest';
import {
  dslFlatVariableDisplayKey,
  dslTreeNodeDisplayLabel,
  resolveTemplateTreeNodeVariableId,
} from '../dslVariableUiLabel';

const GUID = '11111111-1111-4111-8111-111111111111';
const GUID_B = '22222222-2222-4222-8222-222222222222';

describe('dslVariableUiLabel', () => {
  it('dslFlatVariableDisplayKey maps GUID keys through translations', () => {
    expect(dslFlatVariableDisplayKey(GUID, { [GUID]: 'Etichetta' })).toBe('Etichetta');
  });

  it('dslFlatVariableDisplayKey leaves non-GUID keys as-is', () => {
    expect(dslFlatVariableDisplayKey('a.b', {})).toBe('a.b');
  });

  it('dslTreeNodeDisplayLabel prefers id when translation exists', () => {
    expect(
      dslTreeNodeDisplayLabel({ id: GUID, label: 'ignored' }, { [GUID]: 'Da traduzione' })
    ).toBe('Da traduzione');
  });

  it('dslTreeNodeDisplayLabel falls back to label without id', () => {
    expect(dslTreeNodeDisplayLabel({ label: 'solo.testo' }, {})).toBe('solo.testo');
  });

  it('resolveTemplateTreeNodeVariableId prefers taskId over id', () => {
    expect(
      resolveTemplateTreeNodeVariableId({ taskId: GUID, id: GUID_B })
    ).toBe(GUID);
  });

  it('resolveTemplateTreeNodeVariableId uses id when taskId absent', () => {
    expect(resolveTemplateTreeNodeVariableId({ id: GUID })).toBe(GUID);
  });

  it('resolveTemplateTreeNodeVariableId falls back to templateId', () => {
    expect(resolveTemplateTreeNodeVariableId({ templateId: GUID })).toBe(GUID);
  });

  it('resolveTemplateTreeNodeVariableId returns empty for non-object', () => {
    expect(resolveTemplateTreeNodeVariableId(null)).toBe('');
  });
});
