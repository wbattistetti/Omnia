import { describe, expect, it } from 'vitest';
import { flattenUtteranceTaskTreeVariableRows } from '../utteranceTaskVariableSync';
import type { TaskTreeNode } from '@types/taskTypes';

describe('flattenUtteranceTaskTreeVariableRows', () => {
  it('single root: one var uses normalized task label only', () => {
    const roots: TaskTreeNode[] = [
      { id: 'n1', templateId: 'n1', label: 'Dimmi se siete', subNodes: [] },
    ];
    const rows = flattenUtteranceTaskTreeVariableRows('Chiedi la disponibilità', roots);
    expect(rows).toHaveLength(1);
    expect(rows[0].nodeId).toBe('n1');
    expect(rows[0].ddtPath).toBe('data[0]');
    expect(rows[0].varName).toContain('disponibilit');
  });

  it('nested: child appends normalized segment', () => {
    const roots: TaskTreeNode[] = [
      {
        id: 'm1',
        templateId: 'm1',
        label: 'Data',
        subNodes: [{ id: 's1', templateId: 's1', label: 'Giorno', subNodes: [] }],
      },
    ];
    const rows = flattenUtteranceTaskTreeVariableRows('Chiedi la data di nascita del paziente', roots);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const byId = Object.fromEntries(rows.map((r) => [r.nodeId, r.varName]));
    expect(byId.m1).toBeDefined();
    expect(byId.s1).toMatch(/giorno/i);
    expect(byId.s1.includes('.')).toBe(true);
  });
});
