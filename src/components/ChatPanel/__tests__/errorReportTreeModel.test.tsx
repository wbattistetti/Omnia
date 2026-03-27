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
  errorFlowId,
  humanIssuesForError,
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

  it('humanIssuesForError returns a single Italian line for TaskNotFound', () => {
    const e = err({ taskId: 't', message: 'x', severity: 'error', category: 'TaskNotFound' });
    const lines = humanIssuesForError(e, 'Row', null);
    expect(lines.length).toBe(1);
    expect(lines[0].message).toContain('comportamento');
    expect(lines[0].error).toBe(e);
  });

  const edgeConditionMessage =
    "Devi definire una condizione per questo collegamento oppure rimuovere l'etichetta.";

  it('humanIssuesForError uses one line for edge/condition categories (no redundant copy)', () => {
    for (const category of [
      'EdgeLabelWithoutCondition',
      'EdgeWithoutCondition',
      'ConditionNotFound',
      'ConditionHasNoScript',
    ] as const) {
      const e = err({ taskId: 't', message: 'x', severity: 'error', category });
      const lines = humanIssuesForError(e, 'Row', null);
      expect(lines.length).toBe(1);
      expect(lines[0].message).toBe(edgeConditionMessage);
    }
  });

  it('buildErrorReportTree always includes main and groups by flow', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: { id: 'main', title: 'Main', nodes: [], edges: [] },
      sf1: {
        id: 'sf1',
        title: 'Indirizzo',
        nodes: [
          {
            id: 'n1',
            data: { rows: [{ id: 'r1', text: 'chiedi indirizzo' }] },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const errors: CompilationError[] = [
      err({
        taskId: 'r1',
        rowId: 'r1',
        nodeId: 'n1',
        message: '[sf1] Task not found for row "x".',
        severity: 'error',
        category: 'TaskNotFound',
      }),
    ];
    const tree = buildErrorReportTree(errors, flows);
    expect(tree.map((t) => t.flowId)).toEqual(['main', 'sf1']);
    expect(tree[0].rows.length).toBe(0);
    expect(tree[1].rows.length).toBe(1);
    expect(tree[1].rows[0].rowTitle).toBe('chiedi indirizzo');
    expect(tree[1].rows[0].issues.length).toBeGreaterThan(0);
  });
});
