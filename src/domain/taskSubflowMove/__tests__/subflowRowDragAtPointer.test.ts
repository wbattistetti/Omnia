import { describe, expect, it } from 'vitest';
import { TaskType } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';
import {
  evaluateSubflowPortalRowDropAtPointer,
  isSubflowPortalRowDropAllowed,
} from '../subflowRowDragAtPointer';

const resolveFixed =
  (flowId: string): ((x: number, y: number, fb: string) => string) =>
  () =>
    flowId;

describe('isSubflowPortalRowDropAllowed', () => {
  const subflow = (childFlowId: string): Task =>
    ({
      id: 't1',
      type: TaskType.Subflow,
      templateId: null,
      flowId: childFlowId,
    }) as Task;

  it('rejects same-flow cross-node for Subflow portal (targetNodeId set)', () => {
    expect(
      isSubflowPortalRowDropAllowed({
        task: subflow('x'),
        sourceFlowCanvasId: 'main',
        sourceNodeId: 'n1',
        targetNodeIdAttr: 'n2',
        clientX: 0,
        clientY: 0,
        resolveFlowCanvasId: resolveFixed('main'),
      })
    ).toBe(false);
  });

  it('allows same-flow drop on same node id (reorder path; not cross-node)', () => {
    expect(
      isSubflowPortalRowDropAllowed({
        task: subflow('x'),
        sourceFlowCanvasId: 'main',
        sourceNodeId: 'n1',
        targetNodeIdAttr: 'n1',
        clientX: 0,
        clientY: 0,
        resolveFlowCanvasId: resolveFixed('main'),
      })
    ).toBe(true);
  });

  it('rejects self-nest on nested flow canvas (canvas spawn: targetNodeId null)', () => {
    expect(
      isSubflowPortalRowDropAllowed({
        task: subflow('nested-1'),
        sourceFlowCanvasId: 'main',
        sourceNodeId: 'n1',
        targetNodeIdAttr: null,
        clientX: 0,
        clientY: 0,
        resolveFlowCanvasId: resolveFixed('nested-1'),
      })
    ).toBe(false);
  });

  it('allows canvas spawn onto another flow', () => {
    expect(
      isSubflowPortalRowDropAllowed({
        task: subflow('nested-1'),
        sourceFlowCanvasId: 'main',
        sourceNodeId: 'n1',
        targetNodeIdAttr: null,
        clientX: 0,
        clientY: 0,
        resolveFlowCanvasId: resolveFixed('other'),
      })
    ).toBe(true);
  });

  it('evaluate returns source and target flow ids for cross-node', () => {
    const ev = evaluateSubflowPortalRowDropAtPointer({
      task: subflow('x'),
      sourceFlowCanvasId: 'main',
      sourceNodeId: 'n1',
      targetNodeIdAttr: 'n2',
      clientX: 0,
      clientY: 0,
      resolveFlowCanvasId: resolveFixed('main'),
    });
    expect(ev.sourceFlowCanvasId).toBe('main');
    expect(ev.targetFlowCanvasId).toBe('main');
    expect(ev.allowed).toBe(false);
  });
});
