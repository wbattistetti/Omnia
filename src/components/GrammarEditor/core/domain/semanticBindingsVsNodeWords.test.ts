// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { validateSemanticBindingsVsNodeWords } from './semanticBindingsVsNodeWords';
import { addBinding, addSynonym, createGrammarNode, updateNodeLabel } from './node';
import type { GrammarNode } from '../../types/grammarTypes';

const basePos = { x: 0, y: 0 };

function nodeWithBindings(
  label: string,
  synonyms: string[],
  bindings: GrammarNode['bindings']
): GrammarNode {
  return {
    ...createGrammarNode(label, basePos, bindings),
    synonyms,
  };
}

describe('validateSemanticBindingsVsNodeWords', () => {
  it('allows semantic-value with a non-empty label and no node synonyms', () => {
    const n = nodeWithBindings('milano', [], [
      { type: 'semantic-value', valueId: 'v1' },
    ]);
    expect(validateSemanticBindingsVsNodeWords(n).isValid).toBe(true);
  });

  it('rejects synonyms with semantic-value', () => {
    const n = nodeWithBindings('x', ['syn'], [{ type: 'semantic-value', valueId: 'v1' }]);
    expect(validateSemanticBindingsVsNodeWords(n).isValid).toBe(false);
  });

  it('rejects non-empty label with semantic-set', () => {
    const n = nodeWithBindings('city', [], [{ type: 'semantic-set', setId: 's1' }]);
    expect(validateSemanticBindingsVsNodeWords(n).isValid).toBe(false);
  });

  it('allows empty label with semantic-set and no synonyms', () => {
    const n = nodeWithBindings('', [], [{ type: 'semantic-set', setId: 's1' }]);
    expect(validateSemanticBindingsVsNodeWords(n).isValid).toBe(true);
  });
});

describe('addBinding respects semantic vs node words', () => {
  it('rejects semantic-value when node already has synonyms', () => {
    const node = nodeWithBindings('a', ['b'], []);
    const result = addBinding(node, { type: 'semantic-value', valueId: 'v1' });
    expect(result.isValid).toBe(false);
  });

  it('rejects semantic-set when label is non-empty', () => {
    const node = nodeWithBindings('hello', [], []);
    const result = addBinding(node, { type: 'semantic-set', setId: 's1' });
    expect(result.isValid).toBe(false);
  });
});

describe('addSynonym and updateNodeLabel', () => {
  it('rejects addSynonym when semantic-value is bound', () => {
    const node = nodeWithBindings('m', [], [{ type: 'semantic-value', valueId: 'v1' }]);
    const r = addSynonym(node, 'extra');
    expect(r.isValid).toBe(false);
  });

  it('rejects updateNodeLabel when semantic-set would get a non-empty label', () => {
    const node = nodeWithBindings('', [], [{ type: 'semantic-set', setId: 's1' }]);
    const r = updateNodeLabel(node, 'text');
    expect(r.isValid).toBe(false);
  });

  it('allows updateNodeLabel for semantic-value node', () => {
    const node = nodeWithBindings('', [], [{ type: 'semantic-value', valueId: 'v1' }]);
    const r = updateNodeLabel(node, 'display');
    expect(r.isValid).toBe(true);
  });
});
