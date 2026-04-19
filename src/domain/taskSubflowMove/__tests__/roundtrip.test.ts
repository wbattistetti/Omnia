/**
 * Strong-restore roundtrip: parent ↔ subflow canvas via StructuralOrchestrator moveTaskRow.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { isDeepStrictEqual } from 'node:util';
import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { reconcileUtteranceVariableStoreWithFlowGraph } from '@domain/structural/reconcileVariableStore';
import {
  runStructuralCommandSync,
  type StructuralOrchestratorContext,
} from '@domain/structural/StructuralOrchestrator';
import { newCommandId } from '@domain/structural/commands';
import { setSubflowSyncFlows } from '../subflowSyncFlowsRef';
import { unregisterSubflowWiringSecondPass } from '../subflowWiringAfterVariableStore';
import {
  captureMoveContextSnapshot,
  logMoveContextSnapshotDiff,
} from '../captureMoveContextSnapshot';

const PORTAL_ROW = '11111111-1111-4111-8111-111111111111';
const MOVED_TASK = '22222222-2222-4222-8222-222222222222';
const PARENT_FLOW = 'main';
const CHILD_FLOW = `subflow_${PORTAL_ROW}`;
const N_MAIN = 'n_main';
const N_CHILD = 'cn';

function clearTaskRepository(): void {
  const tr = taskRepository as unknown as { tasks: Map<string, unknown> };
  tr.tasks.clear();
}

function clearVariableStore(): void {
  const svc = variableCreationService as unknown as { store: Map<string, unknown[]> };
  svc.store.clear();
}

function buildInitialFlows(): WorkspaceState['flows'] {
  return {
    [PARENT_FLOW]: {
      id: PARENT_FLOW,
      title: 'Main',
      nodes: [
        {
          id: N_MAIN,
          data: {
            rows: [
              { id: PORTAL_ROW, text: 'Sub' },
              { id: MOVED_TASK, text: 'Hello' },
            ],
          },
        },
      ],
      edges: [],
      meta: {
        flowInterface: { input: [], output: [] },
        translations: {},
      },
    } as Flow,
    [CHILD_FLOW]: {
      id: CHILD_FLOW,
      title: 'Subflow',
      nodes: [{ id: N_CHILD, data: { rows: [] } }],
      edges: [],
      meta: {
        flowInterface: { input: [], output: [] },
        translations: {},
      },
    } as Flow,
  };
}

describe('roundtrip 1→2→1 (move context snapshot)', () => {
  beforeEach(() => {
    clearTaskRepository();
    clearVariableStore();
    unregisterSubflowWiringSecondPass(MOVED_TASK);
  });

  it('roundtrip 1→2→1 preserves full move context', () => {
    const projectId = `rt_${Math.random().toString(36).slice(2, 11)}`;

    let flowsRef: WorkspaceState['flows'] = buildInitialFlows();
    setSubflowSyncFlows(flowsRef);

    taskRepository.createTask(
      TaskType.Subflow,
      null,
      { label: 'Portal', authoringFlowCanvasId: PARENT_FLOW },
      PORTAL_ROW,
      projectId
    );
    taskRepository.createTask(
      TaskType.SayMessage,
      null,
      { label: 'Say', authoringFlowCanvasId: PARENT_FLOW },
      MOVED_TASK,
      projectId
    );

    reconcileUtteranceVariableStoreWithFlowGraph(projectId, flowsRef, { skipGlobalMerge: true });
    setSubflowSyncFlows(flowsRef);

    const ctx: StructuralOrchestratorContext = {
      projectId,
      getFlows: () => flowsRef,
      commitFlowSlices: (flowsNext, ids) => {
        const next = { ...flowsRef };
        for (const id of ids) {
          const s = flowsNext[id];
          if (s) {
            next[id] =
              typeof structuredClone !== 'undefined'
                ? structuredClone(s)
                : (JSON.parse(JSON.stringify(s)) as Flow);
          }
        }
        flowsRef = next;
        setSubflowSyncFlows(flowsRef);
        return true;
      },
      projectData: { conditions: [] },
      getTranslations: () => ({}),
    };

    const snapA = captureMoveContextSnapshot({
      projectId,
      parentFlowId: PARENT_FLOW,
      childFlowId: CHILD_FLOW,
      taskInstanceId: MOVED_TASK,
      flows: flowsRef,
    });

    runStructuralCommandSync(ctx, {
      type: 'moveTaskRow',
      commandId: newCommandId(),
      source: 'dnd',
      rowId: MOVED_TASK,
      fromFlowId: PARENT_FLOW,
      toFlowId: CHILD_FLOW,
      fromNodeId: N_MAIN,
      toNodeId: N_CHILD,
    });

    runStructuralCommandSync(ctx, {
      type: 'moveTaskRow',
      commandId: newCommandId(),
      source: 'dnd',
      rowId: MOVED_TASK,
      fromFlowId: CHILD_FLOW,
      toFlowId: PARENT_FLOW,
      fromNodeId: N_CHILD,
      toNodeId: N_MAIN,
    });

    const snapC = captureMoveContextSnapshot({
      projectId,
      parentFlowId: PARENT_FLOW,
      childFlowId: CHILD_FLOW,
      taskInstanceId: MOVED_TASK,
      flows: flowsRef,
    });

    if (!isDeepStrictEqual(snapA, snapC)) {
      logMoveContextSnapshotDiff(snapA, snapC);
    }
    expect(snapC).toEqual(snapA);
  });
});
