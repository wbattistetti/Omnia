import { describe, it, expect, vi } from 'vitest';
import {
  buildInitialManualTaskTree,
  isTaskTreeStructurallyEmpty,
  mapLocaleToGeneralizeLabelLang,
  slugifyManualDataKeySegment,
} from '../manualEmptyTaskTreeSeed';

describe('manualEmptyTaskTreeSeed', () => {
  it('slugifyManualDataKeySegment normalizes titles', () => {
    expect(slugifyManualDataKeySegment('Chiedi nome')).toBe('chiedi_nome');
    expect(slugifyManualDataKeySegment('  ')).toBe('data');
  });

  it('mapLocaleToGeneralizeLabelLang maps locale codes', () => {
    expect(mapLocaleToGeneralizeLabelLang('en')).toBe('EN');
    expect(mapLocaleToGeneralizeLabelLang('it')).toBe('IT');
    expect(mapLocaleToGeneralizeLabelLang(null)).toBe('IT');
    expect(mapLocaleToGeneralizeLabelLang('xx')).toBe('IT');
  });

  it('isTaskTreeStructurallyEmpty detects empty trees', () => {
    expect(isTaskTreeStructurallyEmpty(null)).toBe(true);
    expect(isTaskTreeStructurallyEmpty(undefined)).toBe(true);
    expect(isTaskTreeStructurallyEmpty({ labelKey: 'k', nodes: [], steps: {} })).toBe(true);
    expect(isTaskTreeStructurallyEmpty({ labelKey: 'k', nodes: [{ id: '1', templateId: '1', label: 'x' }], steps: {} })).toBe(false);
  });

  it('buildInitialManualTaskTree creates one root node with label from title', () => {
    const tree = buildInitialManualTaskTree('chiedi nome');
    expect(tree.labelKey.startsWith('manual.')).toBe(true);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].label).toBe('chiedi nome');
    expect(tree.nodes[0].id).toBeTruthy();
    const rootKey = tree.nodes[0].templateId ?? tree.nodes[0].id;
    expect(rootKey).toBeTruthy();
    expect(tree.steps && typeof tree.steps === 'object' && !Array.isArray(tree.steps)).toBe(true);
    expect((tree.steps as Record<string, unknown>)?.[rootKey as string]).toBeDefined();
  });
});
