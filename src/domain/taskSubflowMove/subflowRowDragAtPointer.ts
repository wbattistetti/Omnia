/**
 * Pointer-time evaluation for custom row drag (mouse synthetic DnD): one entry point so move
 * and mouseup share the same Subflow portal rules without duplicate taskRepository reads.
 */

import type { Task } from '@types/taskTypes';

import { canAcceptSubflowPortalRowDrop } from './subflowRowDropPolicy';

export type ResolveFlowCanvasIdFn = (clientX: number, clientY: number, fallback: string) => string;

/**
 * Resolves source/target flow ids and Subflow portal acceptance in one pass (avoids double hit-tests).
 */
export function evaluateSubflowPortalRowDropAtPointer(args: {
  task: Task | null | undefined;
  sourceFlowCanvasId: string | undefined;
  sourceNodeId: string;
  targetNodeIdAttr: string | null;
  clientX: number;
  clientY: number;
  resolveFlowCanvasId: ResolveFlowCanvasIdFn;
}): { allowed: boolean; targetFlowCanvasId: string; sourceFlowCanvasId: string } {
  const fromFc = String(args.sourceFlowCanvasId ?? 'main').trim() || 'main';
  const toFc = args.resolveFlowCanvasId(args.clientX, args.clientY, fromFc);
  const tid = args.targetNodeIdAttr != null ? String(args.targetNodeIdAttr).trim() : '';
  const sameFlowCrossNode =
    tid !== '' && String(toFc).trim() === String(fromFc).trim() && tid !== args.sourceNodeId;
  const allowed = canAcceptSubflowPortalRowDrop(args.task, toFc, {
    sameFlowCrossNodeDrop: sameFlowCrossNode,
  });
  return { allowed, targetFlowCanvasId: toFc, sourceFlowCanvasId: fromFc };
}

/**
 * Whether a Subflow portal row may be dropped at (clientX, clientY).
 * - Pass `targetNodeIdAttr` when the pointer is over another React Flow node (cross-node).
 * - Pass `null` when treating the drop as empty-pane canvas spawn (new node); cross-node is then false.
 */
export function isSubflowPortalRowDropAllowed(args: {
  task: Task | null | undefined;
  sourceFlowCanvasId: string | undefined;
  sourceNodeId: string;
  targetNodeIdAttr: string | null;
  clientX: number;
  clientY: number;
  resolveFlowCanvasId: ResolveFlowCanvasIdFn;
}): boolean {
  return evaluateSubflowPortalRowDropAtPointer(args).allowed;
}
