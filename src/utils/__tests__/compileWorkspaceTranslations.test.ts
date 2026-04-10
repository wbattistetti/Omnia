import { describe, expect, it, beforeEach } from 'vitest';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import {
  compileWorkspaceTranslations,
  flattenFlowMetaTranslationsFromSnapshot,
  flowWorkspaceMetaTranslationsFingerprint,
} from '../compileWorkspaceTranslations';

describe('compileWorkspaceTranslations', () => {
  beforeEach(() => {
    FlowWorkspaceSnapshot.setSnapshot({}, 'main');
  });

  it('merges global then flow; flow overwrites global on same key', () => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: {
          nodes: [],
          edges: [],
          meta: { translations: { 'task:aaa': 'from flow', 'task:only': 'x' } },
        },
      },
      'main'
    );
    const compiled = compileWorkspaceTranslations({ 'task:aaa': 'from global', runtime: 'r' });
    expect(compiled.runtime).toBe('r');
    expect(compiled['task:aaa']).toBe('from flow');
    expect(compiled['task:only']).toBe('x');
  });

  it('flattenFlowMetaTranslationsFromSnapshot is deterministic by sorted flow id', () => {
    FlowWorkspaceSnapshot.setSnapshot(
      {
        main: { nodes: [], edges: [], meta: { translations: { a: '1' } } },
        z_sub: { nodes: [], edges: [], meta: { translations: { a: '2' } } },
      },
      'main'
    );
    const flat = flattenFlowMetaTranslationsFromSnapshot();
    expect(flat.a).toBe('2');
  });

  it('fingerprint changes when meta.translations change', () => {
    const a = flowWorkspaceMetaTranslationsFingerprint();
    FlowWorkspaceSnapshot.setSnapshot(
      { main: { nodes: [], edges: [], meta: { translations: { k: 'v' } } } },
      'main'
    );
    const b = flowWorkspaceMetaTranslationsFingerprint();
    expect(a).not.toBe(b);
  });
});
