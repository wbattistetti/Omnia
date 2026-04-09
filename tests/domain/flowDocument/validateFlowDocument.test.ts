// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { assertFlowDocument, normalizeIncomingFlowDocument } from '../../../src/domain/flowDocument/validateFlowDocument';
import type { FlowDocument } from '../../../src/domain/flowDocument/FlowDocument';
import { FLOW_DOCUMENT_VERSION } from '../../../src/domain/flowDocument/FlowDocument';

function minimalDoc(overrides?: Partial<FlowDocument>): FlowDocument {
  return {
    id: 'flow-a',
    projectId: 'proj-1',
    version: FLOW_DOCUMENT_VERSION,
    meta: {
      flowInterface: { input: [], output: [] },
      translations: {},
    },
    nodes: [],
    edges: [],
    tasks: [],
    variables: [],
    bindings: [],
    ...overrides,
  };
}

describe('assertFlowDocument', () => {
  it('accepts a minimal valid document', () => {
    expect(() => assertFlowDocument(minimalDoc())).not.toThrow();
  });

  it('rejects non-objects', () => {
    expect(() => assertFlowDocument(null)).toThrow();
    expect(() => assertFlowDocument(undefined)).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => assertFlowDocument({})).toThrow();
    expect(() =>
      assertFlowDocument(
        minimalDoc({
          id: '',
        })
      )
    ).toThrow();
  });

  it('round-trips through JSON without losing validity', () => {
    const doc = minimalDoc({
      meta: {
        flowInterface: {
          input: [
            {
              id: 'i1',
              variableRefId: 'v1',
              labelKey: 'k.in',
              direction: 'input' as const,
            },
          ],
          output: [],
        },
        translations: { 'k.in': 'Input label' },
      },
    });
    const again = JSON.parse(JSON.stringify(doc));
    expect(() => assertFlowDocument(again)).not.toThrow();
  });
});

describe('normalizeIncomingFlowDocument', () => {
  it('fills missing arrays and meta so assert passes', () => {
    const partial = {
      id: 'main',
      projectId: 'p1',
      version: 1,
      meta: { translations: { a: 'b' } },
    };
    const n = normalizeIncomingFlowDocument(partial, 'p1');
    expect(() => assertFlowDocument(n)).not.toThrow();
    expect(Array.isArray(n.nodes)).toBe(true);
    expect(Array.isArray(n.bindings)).toBe(true);
    expect(Array.isArray(n.meta.flowInterface.input)).toBe(true);
  });
});
