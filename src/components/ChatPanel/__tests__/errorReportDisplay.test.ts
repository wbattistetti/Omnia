import { describe, expect, it } from 'vitest';
import type { CompilationError } from '@components/FlowCompiler/types';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import {
  findRowTextInWorkspace,
  findEdgeLabelInWorkspace,
  formatErrorMessageForReportPanel,
  formatErrorLocationTitle,
  splitFlowPrefixedMessage,
  stripNodeRowReferences,
  truncateDisplayLabel,
} from '../errorReportDisplay';

function err(partial: Partial<CompilationError> & Pick<CompilationError, 'taskId' | 'message' | 'severity'>): CompilationError {
  return {
    taskId: partial.taskId,
    message: partial.message,
    severity: partial.severity,
    fixTarget: partial.fixTarget ?? { type: 'task', taskId: partial.taskId },
    nodeId: partial.nodeId,
    rowId: partial.rowId,
    edgeId: partial.edgeId,
    category: partial.category,
  };
}

describe('errorReportDisplay', () => {
  it('truncateDisplayLabel respects max length', () => {
    expect(truncateDisplayLabel('abc', 10)).toBe('abc');
    expect(truncateDisplayLabel('0123456789abcdef', 10)).toBe('012345678…');
  });

  it('splitFlowPrefixedMessage extracts flow tag', () => {
    expect(splitFlowPrefixedMessage('[main] hello')).toEqual({ flowTag: 'main', body: 'hello' });
    expect(splitFlowPrefixedMessage('no prefix')).toEqual({ flowTag: null, body: 'no prefix' });
  });

  it('stripNodeRowReferences removes in node / row clauses and UUIDs', () => {
    const raw =
      'Task not found: cf2e995a-2850-4527-8d11-0da344cf0a37 in node cf2e995a-2850-4527-8d11-0da344cf0a37, row cf2e995a-2850-4527-8d11-0da344cf0a37-x. Task must exist.';
    const out = stripNodeRowReferences(raw);
    expect(out).not.toMatch(/in node/i);
    expect(out).not.toMatch(/cf2e995a/);
  });

  it('findRowTextInWorkspace resolves row text by rowId or taskId', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [
          {
            id: 'n1',
            data: {
              rows: [{ id: 'row-1', text: 'Saluta utente' }],
            },
          } as Node<FlowNode>,
        ],
        edges: [],
      },
    };
    const e1 = err({
      taskId: 'row-1',
      message: 'x',
      severity: 'error',
      rowId: 'row-1',
      category: 'TaskNotFound',
    });
    expect(findRowTextInWorkspace(flows, e1)).toBe('Saluta utente');
  });

  it('formatErrorMessageForReportPanel uses row label for TaskNotFound', () => {
    const e = err({
      taskId: 't1',
      rowId: 't1',
      message: 'Referenced task does not exist.',
      severity: 'error',
      category: 'TaskNotFound',
    });
    expect(formatErrorMessageForReportPanel(e, 'My row label', null)).toBe(
      'Non hai specificato cosa deve fare «My row label».'
    );
  });

  it('formatErrorMessageForReportPanel preserves flow prefix for TaskNotFound', () => {
    const e = err({
      taskId: 't1',
      message: '[sub] Task not found: x',
      severity: 'error',
      category: 'TaskNotFound',
    });
    expect(formatErrorMessageForReportPanel(e, 'R1', null)).toBe(
      '[sub] Non hai specificato cosa deve fare «R1».'
    );
  });

  it('formatErrorMessageForReportPanel uses parser copy for missing data contract', () => {
    const e = err({
      taskId: 't1',
      message: '[main] Missing data contract (leaf node).',
      severity: 'error',
      category: 'TaskCompilationFailed',
    });
    expect(formatErrorMessageForReportPanel(e, null, null)).toBe(
      "[main] Manca il parser per interpretare le risposte dell'utente."
    );
  });

  it('formatErrorLocationTitle prefers row text and avoids node ids', () => {
    const e = err({
      taskId: 't1',
      nodeId: 'node-uuid',
      message: 'm',
      severity: 'error',
    });
    expect(formatErrorLocationTitle(e, 'Hello row', null)).toBe('Hello row');
  });

  it('findEdgeLabelInWorkspace reads edge label', () => {
    const flows: Record<string, Flow<Node<FlowNode>, Edge>> = {
      main: {
        id: 'main',
        title: 'Main',
        nodes: [],
        edges: [{ id: 'e1', label: 'Yes' } as Edge],
      },
    };
    const e = err({ taskId: 'sys', message: 'm', severity: 'error', edgeId: 'e1' });
    expect(findEdgeLabelInWorkspace(flows, e.edgeId)).toBe('Yes');
  });
});
