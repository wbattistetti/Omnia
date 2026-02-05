// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { assembleFinalTaskTree } from '../assembleFinal';
import type { SchemaNode } from '../dataCollection';
import { buildArtifactStore } from '../artifactStore';

describe('assembleFinalTaskTree - Migration Phase 2', () => {
  beforeEach(() => {
    // Reset any global state if needed
  });

  it('should produce only nodes in Phase 2 (no data)', async () => {
    const rootLabel = 'Test TaskTree';
    const mains: SchemaNode[] = [
      {
        label: 'Date',
        type: 'date',
        subData: [
          { label: 'Day', type: 'number' },
          { label: 'Month', type: 'number' },
          { label: 'Year', type: 'number' }
        ]
      }
    ];

    const store = buildArtifactStore([]);
    const projectLocale = 'en';

    const result = await assembleFinalTaskTree(rootLabel, mains, store, {
      escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
      projectLocale,
      templateTranslations: {},
      addTranslations: () => {}
    });

    // ✅ Phase 2: Should have only nodes (no data)
    expect(result.nodes).toBeDefined();
    expect(result.data).toBeUndefined(); // ✅ data should not be produced
    expect(Array.isArray(result.nodes)).toBe(true);

    // ✅ Should have id and label
    expect(result.id).toBeDefined();
    expect(result.label).toBe(rootLabel);
  });

  it('should produce nodes with correct structure', async () => {
    const rootLabel = 'Address';
    const mains: SchemaNode[] = [
      {
        label: 'Street',
        type: 'text'
      },
      {
        label: 'City',
        type: 'text'
      }
    ];

    const store = buildArtifactStore([]);
    const projectLocale = 'en';

    const result = await assembleFinalTaskTree(rootLabel, mains, store, {
      escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
      projectLocale,
      templateTranslations: {},
      addTranslations: () => {}
    });

    // ✅ Verify nodes array exists
    expect(result.nodes).toBeDefined();
    expect(result.data).toBeUndefined(); // ✅ data should not be produced

    // ✅ Verify nodes have correct length
    expect(result.nodes?.length).toBe(2);

    // ✅ Verify content
    if (result.nodes) {
      expect(result.nodes[0].label).toBe('Street');
      expect(result.nodes[1].label).toBe('City');
    }
  });

  it('should handle empty mains array', async () => {
    const rootLabel = 'Empty';
    const mains: SchemaNode[] = [];

    const store = buildArtifactStore([]);
    const projectLocale = 'en';

    const result = await assembleFinalTaskTree(rootLabel, mains, store, {
      escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
      projectLocale,
      templateTranslations: {},
      addTranslations: () => {}
    });

    // ✅ Should produce only nodes (empty array, no data)
    expect(result.nodes).toBeDefined();
    expect(result.data).toBeUndefined(); // ✅ data should not be produced
    expect(result.nodes?.length).toBe(0);
  });

  it('should preserve node structure in both formats', async () => {
    const rootLabel = 'Composite';
    const mains: SchemaNode[] = [
      {
        label: 'Date',
        type: 'date',
        icon: 'Calendar',
        constraints: [],
        subData: [
          {
            label: 'Day',
            type: 'number',
            constraints: []
          }
        ]
      }
    ];

    const store = buildArtifactStore([]);
    const projectLocale = 'en';

    const result = await assembleFinalTaskTree(rootLabel, mains, store, {
      escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
      projectLocale,
      templateTranslations: {},
      addTranslations: () => {}
    });

    // ✅ Verify structure is preserved in nodes format
    if (result.nodes && result.nodes.length > 0) {
      const nodeMain = result.nodes[0];

      expect(nodeMain.label).toBe('Date');
      expect(nodeMain.type).toBe('date');

      // ✅ Verify subNodes structure
      const nodeSubs = (nodeMain as any).subNodes || (nodeMain as any).subData;

      if (nodeSubs && nodeSubs.length > 0) {
        expect(nodeSubs.length).toBe(1);
        expect(nodeSubs[0].label).toBe('Day');
      }
    }

    // ✅ Verify data is not produced
    expect(result.data).toBeUndefined();
  });
});
