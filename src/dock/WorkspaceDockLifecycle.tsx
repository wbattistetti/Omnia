/**
 * Persists dock layout + open flow tabs per project (localStorage) and restores after flows load.
 * Lives under FlowWorkspaceProvider so it can read flows and sync activeFlowId.
 * Refreshes flow-tab titles when flows or tasks change; prefetches open-tab flow documents after snapshot ids exist in the workspace.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { DockNode } from './types';
import { useFlowActions, useFlowWorkspace } from '@flows/FlowStore';
import { findSubflowTaskByChildFlowId } from '@utils/findSubflowTaskByChildFlowId';
import {
  applyFlowTabDisplayTitles,
  buildDockTreeFromSnapshotForFlows,
  getLastActiveFlowIdFromDock,
  getFlowIdsFromWorkspaceSnapshot,
  loadWorkspaceUiSnapshot,
  saveWorkspaceUiSnapshot,
  snapshotFlowIdsAreLoaded,
} from './projectWorkspaceUiSnapshot';
import { prefetchHydratedFlowSlicesFromServer } from './prefetchSnapshotFlowSlices';

export type WorkspaceDockLifecycleProps = {
  projectId: string | undefined;
  /** When true, skip restore/save (e.g. draft project). */
  skipPersist: boolean;
  dockTree: DockNode;
  setDockTree: React.Dispatch<React.SetStateAction<DockNode>>;
};

export function WorkspaceDockLifecycle({
  projectId,
  skipPersist,
  dockTree,
  setDockTree,
}: WorkspaceDockLifecycleProps): null {
  const { flows } = useFlowWorkspace();
  const { setActiveFlow, renameFlow, upsertFlow } = useFlowActions();
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const restoredRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number>();
  const titleSyncTimerRef = useRef<number>();

  const flowIdsKey = Object.keys(flows ?? {})
    .sort()
    .join('\x1e');

  useLayoutEffect(() => {
    restoredRef.current = null;
  }, [projectId]);

  useLayoutEffect(() => {
    const pid = projectId?.trim();
    if (!pid) return;
    if (skipPersist) {
      restoredRef.current = pid;
      return;
    }
    if (restoredRef.current === pid) return;

    const snap = loadWorkspaceUiSnapshot(pid);
    if (!snap) {
      restoredRef.current = pid;
      return;
    }

    const next = buildDockTreeFromSnapshotForFlows(snap, flows as Record<string, { title?: string } | undefined>);
    if (!next) return;

    setDockTree(next);
    const fid = getLastActiveFlowIdFromDock(next);
    if (fid) setActiveFlow(fid);
    restoredRef.current = pid;
  }, [projectId, flowIdsKey, flows, setDockTree, setActiveFlow, skipPersist]);

  useEffect(() => {
    const pid = projectId?.trim();
    if (!pid || skipPersist) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveWorkspaceUiSnapshot(pid, dockTree);
    }, 500);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [projectId, dockTree, skipPersist]);

  /** After tasks/variables hydrate, refresh tab titles and align generic flow slice titles with Subflow task names. */
  useEffect(() => {
    const pid = projectId?.trim();
    if (!pid || skipPersist) return;

    const run = () => {
      const f = flowsRef.current as Record<string, { title?: string } | undefined>;
      for (const flowId of Object.keys(f ?? {})) {
        const slice = f[flowId];
        const t = typeof slice?.title === 'string' ? slice.title.trim() : '';
        const generic = !t || t === 'Subflow' || t === flowId;
        if (!generic) continue;
        const task = findSubflowTaskByChildFlowId(flowId);
        const name = typeof task?.name === 'string' && task.name.trim() ? task.name.trim() : '';
        if (!name || name === t) continue;
        renameFlow(flowId, name);
      }
      setDockTree((prev) => applyFlowTabDisplayTitles(prev, f));
    };

    const debounced = () => {
      window.clearTimeout(titleSyncTimerRef.current);
      titleSyncTimerRef.current = window.setTimeout(run, 80);
    };

    run();
    document.addEventListener('variableStore:updated', debounced as EventListener);
    window.addEventListener('tasks:loaded', debounced as EventListener);
    return () => {
      document.removeEventListener('variableStore:updated', debounced as EventListener);
      window.removeEventListener('tasks:loaded', debounced as EventListener);
      window.clearTimeout(titleSyncTimerRef.current);
    };
  }, [projectId, skipPersist, flowIdsKey, setDockTree, renameFlow]);

  const prefetchGenRef = useRef(0);

  /** Hydrate open-tab flow slices from API as soon as snapshot flow ids exist in the workspace (before child hosts mount). */
  useEffect(() => {
    const pid = projectId?.trim();
    if (!pid || skipPersist) return;
    const snap = loadWorkspaceUiSnapshot(pid);
    if (!snap) return;
    const ids = new Set(Object.keys(flowsRef.current ?? {}));
    if (!snapshotFlowIdsAreLoaded(snap, ids)) return;

    const flowIds = getFlowIdsFromWorkspaceSnapshot(snap);
    const gen = ++prefetchGenRef.current;
    let cancelled = false;

    void prefetchHydratedFlowSlicesFromServer(pid, flowIds, {
      getFlows: () => flowsRef.current as any,
      upsertFlow: upsertFlow as any,
    }).then(() => {
      if (cancelled || gen !== prefetchGenRef.current) return;
      try {
        document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
      } catch {
        /* noop */
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, skipPersist, flowIdsKey, upsertFlow]);

  return null;
}
