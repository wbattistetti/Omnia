// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  buildModelTree,
  filterModelTree,
  findLeafByModelId,
  splitModelIdIntoSegments,
  type ModelTreeNode,
} from '../buildModelTree';
import type { AvailableLlmModelOption } from '@hooks/useAvailableLlmModels';

const PROVIDERS = [
  { id: 'groq' as const, label: 'Groq' },
  { id: 'openai' as const, label: 'OpenAI' },
];

function opt(provider: 'groq' | 'openai', id: string): AvailableLlmModelOption {
  return { provider, id, label: `[${provider}] ${id}` };
}

function child(node: { children: ReadonlyArray<ModelTreeNode> }, label: string): ModelTreeNode {
  const hit = node.children.find((candidate) => candidate.label === label);
  if (!hit) throw new Error(`Missing child ${label}`);
  return hit;
}

describe('splitModelIdIntoSegments', () => {
  it('splits every - : / separator into a level, while keeping dates atomic', () => {
    expect(splitModelIdIntoSegments('gpt-4o-mini-audio-preview-2024-12-17')).toEqual([
      'gpt',
      '4o',
      'mini',
      'audio',
      'preview',
      '2024-12-17',
    ]);
    expect(splitModelIdIntoSegments('davinci:ft-bluelab-2023-03-22-20-15-04')).toEqual([
      'davinci',
      'ft',
      'bluelab',
      '2023-03-22-20-15-04',
    ]);
    expect(splitModelIdIntoSegments('openai/gpt-oss-120b')).toEqual([
      'openai',
      'gpt',
      'oss',
      '120b',
    ]);
  });
});

describe('buildModelTree', () => {
  it('groups by provider in the order given by config (deterministic UI)', () => {
    const tree = buildModelTree(
      [opt('openai', 'gpt-5'), opt('groq', 'llama-3.3-70b-versatile')],
      { providers: PROVIDERS }
    );
    expect(tree.map((p) => p.providerId)).toEqual(['groq', 'openai']);
  });

  it('builds a deep hierarchy from every separator, preserving dates as one level', () => {
    const tree = buildModelTree(
      [
        opt('openai', 'gpt-4o'),
        opt('openai', 'gpt-4o-2024-08-06'),
        opt('openai', 'gpt-4o-mini-audio-preview-2024-12-17'),
      ],
      { providers: PROVIDERS }
    );
    const openai = tree.find((p) => p.providerId === 'openai')!;
    const gpt = child(openai, 'gpt');
    const fourO = child(gpt, '4o');
    expect(fourO.selectableModelId).toBe('gpt-4o');
    expect(fourO.children.map((node) => node.label)).toEqual(['2024-08-06', 'mini']);
    const mini = child(fourO, 'mini');
    const preview = child(child(mini, 'audio'), 'preview');
    expect(child(preview, '2024-12-17').selectableModelId).toBe(
      'gpt-4o-mini-audio-preview-2024-12-17'
    );
  });

  it('sorts sibling nodes naturally', () => {
    const tree = buildModelTree(
      [
        opt('openai', 'gpt-5'),
        opt('openai', 'gpt-3.5-turbo'),
        opt('openai', 'gpt-4o'),
        opt('openai', 'gpt-4o-mini'),
      ],
      { providers: PROVIDERS }
    );
    const gpt = tree.find((p) => p.providerId === 'openai')!.children[0];
    expect(gpt.label).toBe('gpt');
    expect(gpt.children.map((node) => node.label)).toEqual(['3.5', '4o', '5']);
  });

  it('keeps the provider node even when it has no models (so the user knows the catalog is empty)', () => {
    const tree = buildModelTree([opt('openai', 'gpt-5')], { providers: PROVIDERS });
    const groq = tree.find((p) => p.providerId === 'groq');
    expect(groq).toBeDefined();
    expect(groq?.children).toHaveLength(0);
    expect(groq?.modelCount).toBe(0);
  });

  it('counts leaves accurately at the provider level for the row counter', () => {
    const tree = buildModelTree(
      [
        opt('openai', 'gpt-5'),
        opt('openai', 'gpt-4o'),
        opt('openai', 'dall-e-3'),
      ],
      { providers: PROVIDERS }
    );
    const openai = tree.find((p) => p.providerId === 'openai')!;
    expect(openai.modelCount).toBe(3);
  });

  it('marks only complete model paths as selectable', () => {
    const tree = buildModelTree([opt('openai', 'gpt-5')], { providers: PROVIDERS });
    const gpt = tree.find((p) => p.providerId === 'openai')!.children[0];
    const five = child(gpt, '5');
    expect(gpt.selectableModelId).toBeUndefined();
    expect(five.selectableModelId).toBe('gpt-5');
  });
});

describe('findLeafByModelId', () => {
  const tree = buildModelTree(
    [opt('openai', 'gpt-5'), opt('openai', 'gpt-4o'), opt('groq', 'llama-3.3-70b-versatile')],
    { providers: PROVIDERS }
  );

  it('returns the matching provider/node/ancestors triplet', () => {
    const hit = findLeafByModelId(tree, 'gpt-4o');
    expect(hit?.provider.providerId).toBe('openai');
    expect(hit?.ancestors.map((node) => node.label)).toEqual(['gpt']);
    expect(hit?.node.label).toBe('4o');
    expect(hit?.node.selectableModelId).toBe('gpt-4o');
  });

  it('returns null when the id is not in the tree (e.g. deprecated stored model)', () => {
    expect(findLeafByModelId(tree, 'gpt-3-davinci')).toBeNull();
    expect(findLeafByModelId(tree, '')).toBeNull();
    expect(findLeafByModelId(tree, null)).toBeNull();
  });
});

describe('filterModelTree', () => {
  const tree = buildModelTree(
    [
      opt('openai', 'gpt-5'),
      opt('openai', 'gpt-4o'),
      opt('openai', 'dall-e-3'),
      opt('groq', 'llama-3.3-70b-versatile'),
      opt('groq', 'mixtral-8x7b-32768'),
    ],
    { providers: PROVIDERS }
  );

  it('returns the original tree (cloned) when the query is empty', () => {
    const out = filterModelTree(tree, '   ');
    expect(out.map((p) => p.providerId)).toEqual(['groq', 'openai']);
  });

  it('matches against selectable model ids', () => {
    const out = filterModelTree(tree, 'mixtral');
    expect(out).toHaveLength(1);
    expect(out[0].providerId).toBe('groq');
    expect(out[0].children).toHaveLength(1);
    expect(out[0].children[0].label).toBe('mixtral');
    expect(out[0].children[0].modelCount).toBe(1);
  });

  it('keeps all leaves when the provider label matches (acts like an entire-branch filter)', () => {
    const out = filterModelTree(tree, 'openai');
    expect(out).toHaveLength(1);
    expect(out[0].providerId).toBe('openai');
    expect(out[0].modelCount).toBe(3);
  });

  it('prunes branches that have no matches so the UI does not show empty groups', () => {
    const out = filterModelTree(tree, 'gpt');
    expect(out.map((p) => p.providerId)).toEqual(['openai']);
  });
});
