import { describe, it, expect } from 'vitest';
import {
  edgeLinkChoiceFromIntellisenseItem,
  edgeLinkChoiceFromInputText,
} from '../edgeLinkChoice';
import type { IntellisenseItem } from '../../../types/intellisense';

const baseItem = (over: Partial<IntellisenseItem>): IntellisenseItem => ({
  id: 'x',
  label: 'L',
  value: 'v',
  category: 'c',
  categoryType: 'conditions',
  kind: 'condition',
  ...over,
});

describe('edgeLinkChoice', () => {
  it('maps catalog item', () => {
    const item = baseItem({ id: 'cond-1', label: 'Foo' });
    expect(edgeLinkChoiceFromIntellisenseItem(item)).toEqual({ kind: 'catalog', item });
  });

  it('maps __else__ and __unlinked__', () => {
    expect(edgeLinkChoiceFromIntellisenseItem(baseItem({ id: '__else__' }))).toEqual({ kind: 'else' });
    expect(edgeLinkChoiceFromIntellisenseItem(baseItem({ id: '__unlinked__' }))).toEqual({ kind: 'unlinked' });
  });

  it('maps input text to freeText or unlinked', () => {
    expect(edgeLinkChoiceFromInputText('  hello  ')).toEqual({ kind: 'freeText', text: 'hello' });
    expect(edgeLinkChoiceFromInputText('')).toEqual({ kind: 'unlinked' });
    expect(edgeLinkChoiceFromInputText('   ')).toEqual({ kind: 'unlinked' });
  });
});
