import { describe, expect, it } from 'vitest';
import { buildAdvancementInsertMenuModel } from './advancementInsertMenuModel';

describe('buildAdvancementInsertMenuModel', () => {
  it('unified: flow labels, sorted param keys', () => {
    const m = buildAdvancementInsertMenuModel({
      editorVariant: 'unifiedBackend',
      wireKey: '__backend__',
      snippetParamFieldKeys: ['zebra', 'a'],
      snippetFlowVariables: [
        { id: 'guid-1', label: 'nome' },
        { id: 'guid-2', label: 'cognome' },
      ],
    });
    expect(m.mode).toBe('unified');
    expect(m.paramKeys).toEqual(['a', 'zebra']);
    expect(m.flowRows.map((r) => r.displayLabel)).toEqual(['nome', 'cognome']);
    expect(m.flowRows[0].insertText).toContain('variabile flusso');
    expect(m.flowRows[0].insertText).toContain('guid-1');
  });

  it('single: paramKeys from wireKey', () => {
    const m = buildAdvancementInsertMenuModel({
      editorVariant: 'singleParam',
      wireKey: 'days',
    });
    expect(m.mode).toBe('single');
    expect(m.paramKeys).toEqual(['days']);
    expect(m.flowRows).toHaveLength(0);
  });
});
