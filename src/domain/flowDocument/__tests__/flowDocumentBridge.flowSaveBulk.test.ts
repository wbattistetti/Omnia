/**
 * FLOW.SAVE-BULK REFACTOR — load path: FlowDocument.meta.translations surface in FlowStore meta.
 */

import { describe, expect, it } from 'vitest';
import { flowDocumentToFlowMeta } from '../flowDocumentBridge';
import type { FlowDocument } from '../FlowDocument';

function minimalDoc(meta: FlowDocument['meta']): FlowDocument {
  return {
    id: 'main',
    projectId: 'p1',
    version: 1,
    nodes: [],
    edges: [],
    tasks: [],
    variables: [],
    bindings: [],
    meta,
  };
}

describe('flowDocumentToFlowMeta (FLOW.SAVE-BULK)', () => {
  it('copies doc.meta.translations into result meta', () => {
    const doc = minimalDoc({
      translations: { 'task:550e8400-e29b-41d4-a716-446655440030': 'Label A' },
      flowInterface: { input: [], output: [] },
    });
    const meta = flowDocumentToFlowMeta(doc);
    expect(meta?.translations?.['task:550e8400-e29b-41d4-a716-446655440030']).toBe('Label A');
  });
});
