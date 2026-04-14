import { describe, expect, it } from 'vitest';
import {
  interfaceOutputLeafDisplayName,
  leafFromQualifiedDisplayName,
  leafLabelForNewInterfaceOutputRow,
  resolveVariableDisplayName,
} from '../resolveVariableDisplayName';
import { makeTranslationKey } from '../translationKeys';

const VID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('resolveVariableDisplayName', () => {
  it('flowInterfaceOutput returns leaf from var: FQ string', () => {
    const varKey = makeTranslationKey('var', VID);
    expect(
      resolveVariableDisplayName(VID, 'flowInterfaceOutput', {
        flowMetaTranslations: { [varKey]: 'dati personali.nome' },
      })
    ).toBe('nome');
  });

  it('flowCanvasToken prefers flow var: then compiled', () => {
    const varKey = makeTranslationKey('var', VID);
    expect(
      resolveVariableDisplayName(VID, 'flowCanvasToken', {
        flowMetaTranslations: { [varKey]: 'solo flow' },
        compiledTranslations: { [varKey]: 'compiled' },
      })
    ).toBe('solo flow');
    expect(
      resolveVariableDisplayName(VID, 'flowCanvasToken', {
        flowMetaTranslations: {},
        compiledTranslations: { [varKey]: 'da compiled' },
      })
    ).toBe('da compiled');
  });

  it('menuVariables prefers compiled over flow-only', () => {
    const varKey = makeTranslationKey('var', VID);
    expect(
      resolveVariableDisplayName(VID, 'menuVariables', {
        flowMetaTranslations: { [varKey]: 'flow' },
        compiledTranslations: { [varKey]: 'compiled wins' },
      })
    ).toBe('compiled wins');
  });
});

describe('leafFromQualifiedDisplayName', () => {
  it('takes last segment', () => {
    expect(leafFromQualifiedDisplayName('a.b.c')).toBe('c');
    expect(leafFromQualifiedDisplayName('nome')).toBe('nome');
  });
});

describe('leafLabelForNewInterfaceOutputRow', () => {
  it('uses row text when flow has nodes', () => {
    const flows = {
      sf: {
        id: 'sf',
        nodes: [
          { id: 'n1', data: { rows: [{ id: VID, text: 'chiedi età' }] } },
        ],
      },
    } as any;
    expect(leafLabelForNewInterfaceOutputRow(VID, 'sf', flows, {})).toBe('chiedi età');
  });
});

describe('interfaceOutputLeafDisplayName', () => {
  it('falls back to task row text when meta has no var: entry', () => {
    const flows = {
      sf: {
        id: 'sf',
        nodes: [{ id: 'n1', data: { rows: [{ id: VID, text: 'nome utente' }] } }],
      },
    } as any;
    expect(interfaceOutputLeafDisplayName(VID, 'sf', flows, {})).toBe('nome utente');
  });

  it('prefers var: translation over row text when both exist', () => {
    const varKey = `var:${VID}`;
    const flows = {
      sf: {
        id: 'sf',
        meta: { translations: { [varKey]: 'dati.nomeDisplay' } },
        nodes: [{ id: 'n1', data: { rows: [{ id: VID, text: 'nome utente' }] } }],
      },
    } as any;
    expect(interfaceOutputLeafDisplayName(VID, 'sf', flows, {})).toBe('nomeDisplay');
  });
});
