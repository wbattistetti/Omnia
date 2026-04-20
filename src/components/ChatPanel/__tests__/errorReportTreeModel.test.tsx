import { describe, expect, it, vi } from 'vitest';
import { HelpCircle } from 'lucide-react';
import type { CompilationError } from '@components/FlowCompiler/types';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { TaskType } from '@types/taskTypes';

vi.mock('@components/Flowchart/utils/taskVisuals', () => ({
  getTaskVisuals: () => ({
    Icon: HelpCircle,
    labelColor: '#94a3b8',
    iconColor: '#94a3b8',
  }),
  hasTaskTree: () => false,
  resolveTaskType: () => TaskType.UNDEFINED,
}));

import {
  buildErrorReportTree,
  canvasRowOrderRankInFlow,
  dedupeHumanIssuesByFixKey,
  errorFlowId,
  humanIssuesForError,
  inferCompilationErrorFlowId,
  resolveUxNodeIdForError,
  uxReportGroupKey,
} from '../errorReportTreeModel';

function err(p: Partial<CompilationError> & Pick<CompilationError, 'taskId' | 'message' | 'severity'>): CompilationError {
  return {
    ...p,
    fixTarget: p.fixTarget ?? { type: 'task', taskId: p.taskId },
  } as CompilationError;
}

vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    getTask: () => null,
  },
}));

describe('errorReportTreeModel', () => {
  it('errorFlowId reads [flow] prefix', () => {
    expect(errorFlowId(err({ taskId: 't', message: '[addr] x', severity: 'error' }))).toBe('addr');
    expect(errorFlowId(err({ taskId: 't', message: 'no prefix', severity: 'error' }))).toBe('main');
  });

  it('inferCompilationErrorFlowId resolves flow from row id when message has no prefix', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      sf1: {
        id: 'sf1',
        title: 'Sub',
        nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'x' }] } } as Node<FlowNode>],
        edges: [],
      },
    };
    expect(
      inferCompilationErrorFlowId(flows, err({ taskId: 'r1', rowId: 'r1', message: '', severity: 'error' }))
    ).toBe('sf1');
  });

  it('humanIssuesForError ignores legacy categories without UX code', () => {
    const e = err({ taskId: 't', message: 'x', severity: 'error', category: 'TaskNotFound' });
    expect(humanIssuesForError(e, 'Row', null)).toEqual([]);
  });

  it('humanIssuesForError maps EscalationActionsMissing with step label', () => {
    const e = err({
      taskId: 't1',
      message: '',
      severity: 'error',
      code: 'EscalationActionsMissing',
      stepKey: 'noMatch',
      escalationIndex: 0,
      fixTarget: { type: 'taskEscalation', taskId: 't1', stepKey: 'noMatch', escalationIndex: 0 },
    });
    const lines = humanIssuesForError(e, 'Row', null);
    expect(lines).toHaveLength(1);
    expect(lines[0].message).toBe('Mancano azioni in «Non capisco».');
  });

  it('humanIssuesForError maps ParserMissing', () => {
    const e = err({
      taskId: 't1',
      message: '',
      severity: 'error',
      code: 'ParserMissing',
      nodeId: 'n1',
    });
    expect(humanIssuesForError(e, null, null)[0].message).toBe('Manca il parser.');
  });

  it('dedupeHumanIssuesByFixKey keeps one line when message and fix target match', () => {
    const e1 = err({
      taskId: 'SYSTEM',
      message: '',
      severity: 'error',
      code: 'EscalationActionsMissing',
      stepKey: 'start',
      escalationIndex: 0,
      fixTarget: { type: 'taskEscalation', taskId: 'rowA', stepKey: 'start', escalationIndex: 0 },
    });
    const msg = 'Mancano azioni in «Chiedo il dato».';
    const deduped = dedupeHumanIssuesByFixKey([
      { message: msg, error: e1 },
      { message: msg, error: { ...e1, escalationIndex: 0 } },
    ]);
    expect(deduped.length).toBe(1);
  });

  it('buildErrorReportTree groups UX errors by flow and row (not shared node title)', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'node-a',
            data: { label: 'Blocco', rows: [{ id: 'row-1', text: 'Chiedi nome' }] },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const errors: CompilationError[] = [
      err({
        taskId: 'row-1',
        rowId: 'row-1',
        nodeId: 'node-a',
        message: '',
        severity: 'error',
        code: 'EscalationActionsMissing',
        stepKey: 'start',
        escalationIndex: 0,
      }),
      err({
        taskId: 'row-1',
        rowId: 'row-1',
        nodeId: 'node-a',
        message: '',
        severity: 'error',
        code: 'EscalationActionsMissing',
        stepKey: 'noMatch',
        escalationIndex: 0,
      }),
      err({
        taskId: 'row-1',
        rowId: 'row-1',
        nodeId: 'node-a',
        message: '',
        severity: 'error',
        code: 'ParserMissing',
      }),
    ];
    const tree = buildErrorReportTree(errors, flows);
    expect(tree).toHaveLength(1);
    expect(tree[0].flowId).toBe('main');
    expect(tree[0].rows).toHaveLength(1);
    expect(tree[0].rows[0].rowTitle).toBe('Chiedi nome');
    expect(tree[0].rows[0].issues.map((i) => i.message)).toEqual([
      'Mancano azioni in «Chiedo il dato».',
      'Mancano azioni in «Non capisco».',
      'Manca il parser.',
    ]);
  });

  it('resolveUxNodeIdForError prefers canvas node from rowId over compiler nodeId', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'node-a',
            data: { label: 'Chiedi nome', rows: [{ id: 'row-1', text: 'x' }] },
          } as Node<FlowNode>,
          {
            id: 'node-wrong',
            data: { label: 'Altri dati', rows: [] },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const e = err({
      taskId: 'row-1',
      rowId: 'row-1',
      nodeId: 'node-wrong',
      message: '',
      severity: 'error',
      code: 'ParserMissing',
    });
    expect(resolveUxNodeIdForError(flows, 'main', e)).toBe('node-a');
  });

  it('buildErrorReportTree titles group from canvas row, not wrong compiler nodeId', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'node-a',
            data: { label: 'Blocco', rows: [{ id: 'row-1', text: 'Chiedi nome' }] },
          } as Node<FlowNode>,
          {
            id: 'node-wrong',
            data: { label: 'Chiedi dati personali', rows: [] },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const errors: CompilationError[] = [
      err({
        taskId: 'row-1',
        rowId: 'row-1',
        nodeId: 'node-wrong',
        message: '',
        severity: 'error',
        code: 'ParserMissing',
      }),
    ];
    const tree = buildErrorReportTree(errors, flows);
    expect(tree[0].rows).toHaveLength(1);
    expect(tree[0].rows[0].rowTitle).toBe('Chiedi nome');
    expect(tree[0].rows[0].nodeId).toBe('node-a');
  });

  it('buildErrorReportTree splits two rows on the same FlowNode into two cards', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'node-a',
            data: {
              label: '',
              rows: [
                { id: 'row-nome', text: 'Chiedi nome' },
                { id: 'row-dati', text: 'Chiedi dati personali' },
              ],
            },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const errors: CompilationError[] = [
      err({
        taskId: 'row-nome',
        rowId: 'row-nome',
        nodeId: 'node-a',
        message: '',
        severity: 'error',
        code: 'ParserMissing',
      }),
      err({
        taskId: 'row-dati',
        rowId: 'row-dati',
        nodeId: 'node-a',
        message: '',
        severity: 'error',
        code: 'ResponseMessageMissing',
      }),
    ];
    const tree = buildErrorReportTree(errors, flows);
    expect(tree[0].rows).toHaveLength(2);
    expect(tree[0].rows.map((r) => r.rowTitle)).toEqual(['Chiedi nome', 'Chiedi dati personali']);
    expect(uxReportGroupKey(flows, 'main', errors[0])).toBe('main::row::row-nome');
    expect(uxReportGroupKey(flows, 'main', errors[1])).toBe('main::row::row-dati');
  });

  it('canvasRowOrderRankInFlow follows node order then row order', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'n1',
            data: { rows: [{ id: 'r-a', text: 'A' }] },
          } as Node<FlowNode>,
          {
            id: 'n2',
            data: { rows: [{ id: 'r-b', text: 'B' }] },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    expect(canvasRowOrderRankInFlow(flows, 'main', 'r-a')).toBe(0);
    expect(canvasRowOrderRankInFlow(flows, 'main', 'r-b')).toBe(1);
    expect(canvasRowOrderRankInFlow(flows, 'main', 'missing')).toBeGreaterThan(1e15);
  });

  it('buildErrorReportTree ignores errors without UX contract codes', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: { id: 'main', title: 'Main', nodes: [], edges: [] },
    };
    const tree = buildErrorReportTree(
      [
        err({
          taskId: 't',
          message: 'legacy',
          severity: 'error',
          category: 'TaskNotFound',
        }),
      ],
      flows
    );
    expect(tree).toHaveLength(0);
  });
});
