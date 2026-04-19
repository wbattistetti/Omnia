import { describe, expect, it } from 'vitest';
import {
  cloneTranslationsToChild,
  getTranslationsForKeys,
  removeTranslationKeysFromFlowSlice,
  resolveTranslationKeysInFlow,
  varTranslationKeysForIds,
} from '../taskMoveTranslationPipeline';

const VID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('taskMoveTranslationPipeline', () => {
  it('cloneTranslationsToChild copies var: 1:1 when child has no key', () => {
    const varKey = `var:${VID}`;
    const flows = {
      parent: {
        id: 'parent',
        title: 'p',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'nome utente' } },
      },
      child: {
        id: 'child',
        title: 'c',
        nodes: [],
        edges: [],
        meta: { translations: {} },
      },
    } as any;
    const next = cloneTranslationsToChild(flows, 'parent', 'child', new Set([varKey]));
    expect((next.child.meta!.translations as any)[varKey]).toBe('nome utente');
    expect((next.parent.meta!.translations as any)[varKey]).toBe('nome utente');
  });

  it('cloneTranslationsToChild skips copy when child already has same value (idempotent)', () => {
    const varKey = `var:${VID}`;
    const flows = {
      parent: {
        id: 'parent',
        title: 'p',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'same' } },
      },
      child: {
        id: 'child',
        title: 'c',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'same' } },
      },
    } as any;
    const next = cloneTranslationsToChild(flows, 'parent', 'child', new Set([varKey]));
    expect((next.child.meta!.translations as any)[varKey]).toBe('same');
    expect(next.child.hasLocalChanges).not.toBe(true);
  });

  it('cloneTranslationsToChild overwrites child when same key exists with different value (origin wins)', () => {
    const varKey = `var:${VID}`;
    const flows = {
      parent: {
        id: 'parent',
        title: 'p',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'a' } },
      },
      child: {
        id: 'child',
        title: 'c',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'b' } },
      },
    } as any;
    const next = cloneTranslationsToChild(flows, 'parent', 'child', new Set([varKey]));
    expect((next.child.meta!.translations as any)[varKey]).toBe('a');
    expect(next.child.hasLocalChanges).toBe(true);
  });

  it('removeTranslationKeysFromFlowSlice removes listed keys', () => {
    const varKey = `var:${VID}`;
    const flows = {
      main: {
        id: 'main',
        title: 'm',
        nodes: [],
        edges: [],
        meta: { translations: { [varKey]: 'x', 'task:other': 'y' } },
      },
    } as any;
    const next = removeTranslationKeysFromFlowSlice(flows, 'main', new Set([varKey]));
    expect((next.main.meta!.translations as any)[varKey]).toBeUndefined();
    expect((next.main.meta!.translations as any)['task:other']).toBe('y');
  });

  it('varTranslationKeysForIds builds canonical keys', () => {
    expect(varTranslationKeysForIds([VID])).toEqual([`var:${VID}`]);
  });

  it('getTranslationsForKeys returns entries for resolved keys', () => {
    const varKey = `var:${VID}`;
    const flow = {
      id: 'f',
      title: 'f',
      nodes: [],
      edges: [],
      meta: { translations: { [varKey]: 'L' } },
    } as any;
    const t = getTranslationsForKeys(flow, [VID, varKey]);
    expect(t[varKey]).toBe('L');
  });

  it('resolveTranslationKeysInFlow finds key by bare uuid', () => {
    const varKey = `var:${VID}`;
    const flow = {
      meta: { translations: { [varKey]: 'L' } },
    } as any;
    expect(resolveTranslationKeysInFlow(flow, VID)).toContain(varKey);
  });
});
