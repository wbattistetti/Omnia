// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { cloneFlowDocument } from '../../../src/domain/flowDocument/cloneFlowDocument';
import type { FlowDocument } from '../../../src/domain/flowDocument/FlowDocument';
import { FLOW_DOCUMENT_VERSION } from '../../../src/domain/flowDocument/FlowDocument';
import { assertFlowDocument } from '../../../src/domain/flowDocument/validateFlowDocument';

function sampleDoc(): FlowDocument {
  return {
    id: 'original-flow',
    projectId: 'proj-1',
    version: FLOW_DOCUMENT_VERSION,
    meta: {
      flowInterface: {
        input: [
          {
            id: 'row-in-1',
            variableRefId: 'var-a',
            labelKey: 'label.key.in',
            direction: 'input',
          },
        ],
        output: [
          {
            id: 'row-out-1',
            variableRefId: 'var-b',
            labelKey: 'label.key.out',
            direction: 'output',
          },
        ],
      },
      translations: {
        'label.key.in': 'Input',
        'label.key.out': 'Output',
      },
    },
    nodes: [{ id: 'n1' }],
    edges: [],
    tasks: [],
    variables: [],
    bindings: [],
  };
}

describe('cloneFlowDocument', () => {
  it('assigns new flow id and preserves projectId when omitted', () => {
    const c = cloneFlowDocument(sampleDoc(), { newFlowId: 'cloned-id' });
    expect(c.id).toBe('cloned-id');
    expect(c.projectId).toBe('proj-1');
    assertFlowDocument(c);
  });

  it('overrides projectId when provided', () => {
    const c = cloneFlowDocument(sampleDoc(), { newFlowId: 'x', projectId: 'other-proj' });
    expect(c.projectId).toBe('other-proj');
  });

  it('generates new interface row ids and preserves translations', () => {
    const src = sampleDoc();
    const c = cloneFlowDocument(src, { newFlowId: 'new-flow' });
    expect(c.meta.flowInterface.input[0].id).not.toBe(src.meta.flowInterface.input[0].id);
    expect(c.meta.flowInterface.output[0].id).not.toBe(src.meta.flowInterface.output[0].id);
    expect(c.meta.flowInterface.input[0].variableRefId).toBe('var-a');
    expect(c.meta.translations).toEqual(src.meta.translations);
    expect(c.version).toBe(FLOW_DOCUMENT_VERSION);
  });
});
