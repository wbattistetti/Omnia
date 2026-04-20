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
    detailCode: partial.detailCode,
    code: partial.code,
    stepKey: partial.stepKey,
    escalationIndex: partial.escalationIndex,
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

  it('formatErrorMessageForReportPanel maps ParserMissing', () => {
    const e = err({
      taskId: 't1',
      message: '',
      severity: 'error',
      code: 'ParserMissing',
    });
    expect(formatErrorMessageForReportPanel(e, null, null)).toBe('Manca il parser.');
  });

  it('formatErrorMessageForReportPanel preserves optional flow prefix', () => {
    const e = err({
      taskId: 't1',
      message: '[sub] ',
      severity: 'error',
      code: 'ParserMissing',
    });
    expect(formatErrorMessageForReportPanel(e, null, null)).toBe('[sub] Manca il parser.');
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
