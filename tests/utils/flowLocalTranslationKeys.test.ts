// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { FlowWorkspaceSnapshot } from '../../src/flows/FlowWorkspaceSnapshot';
import { collectFlowLocalTranslationKeysFromWorkspace } from '../../src/utils/flowLocalTranslationKeys';

describe('collectFlowLocalTranslationKeysFromWorkspace', () => {
  beforeEach(() => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
  });

  it('returns keys from meta.translations on each flow slice', () => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [],
          edges: [],
          meta: {
            translations: { 'interface:abc': 'Label', 'k2': 'v2' },
          },
        } as any,
        subflow_x: {
          nodes: [],
          edges: [],
          meta: { translations: { onlyHere: 'x' } },
        } as any,
      },
      'main'
    );
    const s = collectFlowLocalTranslationKeysFromWorkspace();
    expect(s.has('interface:abc')).toBe(true);
    expect(s.has('k2')).toBe(true);
    expect(s.has('onlyHere')).toBe(true);
  });

  it('returns empty set when no translations', () => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: { nodes: [], edges: [], meta: {} } as any,
      },
      'main'
    );
    expect(collectFlowLocalTranslationKeysFromWorkspace().size).toBe(0);
  });
});
