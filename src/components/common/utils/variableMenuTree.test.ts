import { describe, expect, it } from 'vitest';
import {
  buildFlatVariableMenuRows,
  buildRadixVariableMenuTree,
  splitTokenLabelSegments,
} from './variableMenuTree';

type Item = { id: string; varLabel: string; tokenLabel?: string; isFromActiveFlow?: boolean };

describe('splitTokenLabelSegments', () => {
  it('splits on dots and trims', () => {
    expect(splitTokenLabelSegments('dati personali.nome')).toEqual(['dati personali', 'nome']);
  });
});

describe('buildFlatVariableMenuRows', () => {
  it('emits a header and indented leaves for a shared prefix', () => {
    const items: Item[] = [
      { id: '1', varLabel: 'nome', tokenLabel: 'dati personali.nome' },
      { id: '2', varLabel: 'telefono', tokenLabel: 'dati personali.telefono' },
    ];
    const rows = buildFlatVariableMenuRows(items);
    expect(rows).toEqual([
      { kind: 'header', depth: 0, label: 'dati personali' },
      { kind: 'leaf', depth: 1, item: items[0], displayLabel: 'nome' },
      { kind: 'leaf', depth: 1, item: items[1], displayLabel: 'telefono' },
    ]);
  });

  it('does not emit a header when the prefix is itself a selectable variable', () => {
    const items: Item[] = [
      { id: 'a', varLabel: 'foo', tokenLabel: 'foo' },
      { id: 'b', varLabel: 'bar', tokenLabel: 'foo.bar' },
    ];
    const rows = buildFlatVariableMenuRows(items);
    expect(rows.map((r) => r.kind)).toEqual(['leaf', 'leaf']);
    expect(rows[0]).toMatchObject({ kind: 'leaf', depth: 0, displayLabel: 'foo' });
    expect(rows[1]).toMatchObject({ kind: 'leaf', depth: 1, displayLabel: 'bar' });
  });

  it('sorts siblings by segment', () => {
    const items: Item[] = [
      { id: 'z', varLabel: 'z', tokenLabel: 'g.z' },
      { id: 'a', varLabel: 'a', tokenLabel: 'g.a' },
    ];
    const rows = buildFlatVariableMenuRows(items);
    expect(rows[1]).toMatchObject({ kind: 'leaf', displayLabel: 'a' });
    expect(rows[2]).toMatchObject({ kind: 'leaf', displayLabel: 'z' });
  });
});

describe('buildRadixVariableMenuTree', () => {
  it('wraps shared prefix in a sub with subflowGroup when all leaves are Subflow outputs', () => {
    const items: Item[] = [
      { id: '1', varLabel: 'nome', tokenLabel: 'dati personali.nome', isFromActiveFlow: false },
      { id: '2', varLabel: 'telefono', tokenLabel: 'dati personali.telefono', isFromActiveFlow: false },
    ];
    const tree = buildRadixVariableMenuTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      kind: 'sub',
      label: 'dati personali',
      subflowGroup: true,
    });
    if (tree[0]?.kind === 'sub') {
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0]).toMatchObject({ kind: 'item', displayLabel: 'nome' });
      expect(tree[0].children[1]).toMatchObject({ kind: 'item', displayLabel: 'telefono' });
    }
  });

  it('uses subflowGroup false when prefix mixes local and subflow leaves', () => {
    const items: Item[] = [
      { id: 'a', varLabel: 'foo', tokenLabel: 'foo', isFromActiveFlow: true },
      { id: 'b', varLabel: 'bar', tokenLabel: 'foo.bar', isFromActiveFlow: false },
    ];
    const tree = buildRadixVariableMenuTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'sub', label: 'foo', subflowGroup: false });
  });
});
