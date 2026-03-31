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
  dedupeHumanIssuesByFixKey,
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
    expect(lines[0].message).toContain('specificato');
    expect(lines[0].error).toBe(e);
  });

  it('humanIssuesForError uses one Italian line for link/condition edge issues', () => {
    const unified = 'Devi definire una condizione per questo link.';
    for (const category of [
      'LinkMissingCondition',
      'ConditionNotFound',
      'ConditionMissingScript',
    ] as const) {
      const lines = humanIssuesForError(
        err({ taskId: 't', message: 'x', severity: 'error', category }),
        'Row',
        null
      );
      expect(lines[0].message).toBe(unified);
    }
  });

  it('dedupeHumanIssuesByFixKey keeps one line when message and fix target match', () => {
    const edgeErr = err({
      taskId: 'SYSTEM',
      message: 'm1',
      severity: 'error',
      category: 'LinkMissingCondition',
      edgeId: 'e1',
      nodeId: 'n1',
      fixTarget: { type: 'edge', edgeId: 'e1' },
    });
    const duplicateCompilerRow = { ...edgeErr, message: 'm2' } as CompilationError;
    const unified = 'Devi definire una condizione per questo link.';
    const deduped = dedupeHumanIssuesByFixKey([
      { message: unified, error: edgeErr },
      { message: unified, error: duplicateCompilerRow },
    ]);
    expect(deduped.length).toBe(1);
  });

  it('humanIssuesForError returns Italian copy for EmptyEscalation', () => {
    const e = err({
      taskId: 't1',
      message: 'Dialogue escalation has no actions.',
      severity: 'error',
      category: 'EmptyEscalation',
      fixTarget: { type: 'taskEscalation', taskId: 't1', stepKey: 'noMatch', escalationIndex: 0 },
    });
    const lines = humanIssuesForError(e, 'Row', null);
    expect(lines.length).toBe(1);
    expect(lines[0].message).toContain('escalation');
  });

  it('humanIssuesForError uses fixed Italian copy for CompilationException / TaskCompilationFailed', () => {
    const e = err({
      taskId: 't1',
      message: '[main] NullReference in template X.',
      severity: 'error',
      category: 'CompilationException',
    });
    const lines = humanIssuesForError(e, 'Row', null);
    expect(lines.length).toBe(1);
    expect(lines[0].message).toContain('Aprilo');
    expect(lines[0].message).not.toContain('NullReference');
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
    expect(tree[1].rows[0].sourceErrors.length).toBe(1);
  });
});
