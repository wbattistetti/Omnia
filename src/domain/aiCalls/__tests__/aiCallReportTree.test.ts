/**
 * Unit test per `buildAiCallReportTree`. Le suite coprono:
 *  - aggregazione per `taskId` con snapshot della label pi\u00f9 recente
 *  - storia delle rinomine in `labelHistory`
 *  - confluenza dei record senza `taskId` nel nodo globale (sentinel)
 *  - regola "costEur null se manca su anche un solo record"
 *  - ordinamento per data (default) e alfabetico (con globale in coda)
 *  - propagazione di errorCount e durationMs
 */

import { describe, it, expect } from 'vitest';
import {
  buildAiCallReportTree,
  AI_CALL_REPORT_GLOBAL_NODE_ID,
} from '../aiCallReportTree';
import type { AiCallRecord } from '@services/aiCallsApi';

function rec(overrides: Partial<AiCallRecord> = {}): AiCallRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    ts: overrides.ts ?? '2026-05-01T10:00:00.000Z',
    providerId: overrides.providerId ?? 'openai',
    modelId: overrides.modelId ?? 'gpt-5',
    purpose: overrides.purpose ?? 'AGENT_CREATE',
    inputTokens: overrides.inputTokens ?? 100,
    outputTokens: overrides.outputTokens ?? 50,
    totalTokens: overrides.totalTokens ?? 150,
    costUsd: overrides.costUsd ?? 0.01,
    costEur: overrides.costEur === undefined ? 0.0092 : overrides.costEur,
    durationMs: overrides.durationMs ?? 1000,
    pricingFound: overrides.pricingFound ?? true,
    error: overrides.error ?? null,
    taskId: overrides.taskId ?? null,
    taskLabel: overrides.taskLabel ?? null,
  };
}

describe('buildAiCallReportTree', () => {
  it('produce un albero vuoto per input vuoto', () => {
    const tree = buildAiCallReportTree([]);
    expect(tree.nodes).toEqual([]);
    expect(tree.aggregates.callCount).toBe(0);
    expect(tree.aggregates.costEur).toBeNull();
  });

  it('raggruppa i record per taskId e somma gli aggregati', () => {
    const records = [
      rec({
        id: 'a',
        ts: '2026-05-01T10:00:00.000Z',
        taskId: 't1',
        taskLabel: 'Task Monica',
        costUsd: 0.02,
        costEur: 0.018,
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        durationMs: 1500,
      }),
      rec({
        id: 'b',
        ts: '2026-05-01T11:00:00.000Z',
        taskId: 't1',
        taskLabel: 'Task Monica',
        costUsd: 0.04,
        costEur: 0.036,
        inputTokens: 400,
        outputTokens: 200,
        totalTokens: 600,
        durationMs: 2500,
      }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.nodes).toHaveLength(1);
    const node = tree.nodes[0];
    expect(node.id).toBe('t1');
    expect(node.label).toBe('Task Monica');
    expect(node.aggregates.callCount).toBe(2);
    expect(node.aggregates.costUsd).toBeCloseTo(0.06, 6);
    expect(node.aggregates.costEur).toBeCloseTo(0.054, 6);
    expect(node.aggregates.inputTokens).toBe(600);
    expect(node.aggregates.outputTokens).toBe(300);
    expect(node.aggregates.totalTokens).toBe(900);
    expect(node.aggregates.durationMs).toBe(4000);
  });

  it('mantiene labelHistory in ordine cronologico per task rinominati', () => {
    const records = [
      rec({ ts: '2026-05-01T10:00:00.000Z', taskId: 't1', taskLabel: 'Vecchio nome' }),
      rec({ ts: '2026-05-02T10:00:00.000Z', taskId: 't1', taskLabel: 'Nuovo nome' }),
      rec({ ts: '2026-05-03T10:00:00.000Z', taskId: 't1', taskLabel: 'Nome attuale' }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].label).toBe('Nome attuale');
    expect(tree.nodes[0].labelHistory).toEqual(['Vecchio nome', 'Nuovo nome', 'Nome attuale']);
  });

  it('mette i record senza taskId nel nodo globale (sentinel)', () => {
    const records = [
      rec({ ts: '2026-05-01T10:00:00.000Z', taskId: 't1', taskLabel: 'Task A' }),
      rec({ ts: '2026-05-01T11:00:00.000Z', taskId: null, taskLabel: null }),
      rec({ ts: '2026-05-01T12:00:00.000Z', taskId: null, taskLabel: null }),
    ];
    const tree = buildAiCallReportTree(records, 'date', 'Globale (senza task)');
    expect(tree.nodes).toHaveLength(2);
    const global = tree.nodes.find((n) => n.id === AI_CALL_REPORT_GLOBAL_NODE_ID);
    expect(global).toBeDefined();
    expect(global?.label).toBe('Globale (senza task)');
    expect(global?.aggregates.callCount).toBe(2);
  });

  it('costEur diventa null se anche un solo record del gruppo manca di costEur', () => {
    const records = [
      rec({ taskId: 't1', taskLabel: 'X', costEur: 0.01 }),
      rec({ taskId: 't1', taskLabel: 'X', costEur: null }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].aggregates.costEur).toBeNull();
  });

  it("ordinamento 'date' (default): nodo pi\u00f9 recente in alto", () => {
    const records = [
      rec({ ts: '2026-04-01T10:00:00.000Z', taskId: 'old', taskLabel: 'Vecchio' }),
      rec({ ts: '2026-05-10T10:00:00.000Z', taskId: 'new', taskLabel: 'Nuovo' }),
    ];
    const tree = buildAiCallReportTree(records, 'date');
    expect(tree.nodes.map((n) => n.id)).toEqual(['new', 'old']);
  });

  it("ordinamento 'alphabetical': nodi per label, globale in coda", () => {
    const records = [
      rec({ taskId: 't1', taskLabel: 'Charlie' }),
      rec({ taskId: 't2', taskLabel: 'alpha' }),
      rec({ taskId: 't3', taskLabel: 'Bravo' }),
      rec({ taskId: null, taskLabel: null }),
    ];
    const tree = buildAiCallReportTree(records, 'alphabetical');
    expect(tree.nodes.map((n) => n.label)).toEqual([
      'alpha',
      'Bravo',
      'Charlie',
      'Globale (senza task)',
    ]);
  });

  it('record interni a un nodo restano ordinati per data desc', () => {
    const records = [
      rec({ id: 'old', ts: '2026-05-01T10:00:00.000Z', taskId: 't1', taskLabel: 'X' }),
      rec({ id: 'new', ts: '2026-05-02T10:00:00.000Z', taskId: 't1', taskLabel: 'X' }),
      rec({ id: 'mid', ts: '2026-05-01T15:00:00.000Z', taskId: 't1', taskLabel: 'X' }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.nodes[0].records.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('errorCount conta solo i record con error non-null', () => {
    const records = [
      rec({ taskId: 't1', taskLabel: 'X', error: null }),
      rec({ taskId: 't1', taskLabel: 'X', error: 'boom' }),
      rec({ taskId: 't1', taskLabel: 'X', error: '' }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.nodes[0].aggregates.callCount).toBe(3);
    expect(tree.nodes[0].aggregates.errorCount).toBe(1);
  });

  it('aggregates totali del root = somma di tutti i nodi', () => {
    const records = [
      rec({ taskId: 't1', taskLabel: 'A', costUsd: 0.01, costEur: 0.009, inputTokens: 100 }),
      rec({ taskId: 't2', taskLabel: 'B', costUsd: 0.02, costEur: 0.018, inputTokens: 200 }),
      rec({ taskId: null, costUsd: 0.005, costEur: 0.0045, inputTokens: 50 }),
    ];
    const tree = buildAiCallReportTree(records);
    expect(tree.aggregates.callCount).toBe(3);
    expect(tree.aggregates.costUsd).toBeCloseTo(0.035, 6);
    expect(tree.aggregates.costEur).toBeCloseTo(0.0315, 6);
    expect(tree.aggregates.inputTokens).toBe(350);
  });
});
