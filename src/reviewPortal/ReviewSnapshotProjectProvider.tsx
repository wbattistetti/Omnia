/**
 * Isolated ProjectData context for the review portal — uses the same React contexts as Omnia.
 */

import React from 'react';
import type { ProjectData } from '@types/project';
import { taskRepository } from '@services/TaskRepository';
import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type {
  AgentReviewBackendSnapshot,
  AgentReviewManualBackendEntrySnapshot,
} from '@domain/agentReviewChannel/reviewSnapshots';
import {
  ProjectDataContext,
  ProjectDataUpdateContext,
} from '@context/ProjectDataContext';
import {
  buildReviewSnapshotProjectContext,
  agentTaskStub,
  resolveEphemeralBackendCallTask,
} from './mapReviewSnapshotToProjectContext';
import { buildReviewBackendSnapshotFromPortal } from './buildReviewBackendSnapshotFromPortal';
import { reviewBackendSnapshotsEqual } from './reviewBackendSnapshotEqual';
import { backendTaskWireSyncKey } from './reviewBackendCallTaskWire';

export interface ReviewSnapshotProjectProviderProps {
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  backendSnapshot: AgentReviewBackendSnapshot | null | undefined;
  backendPlaceholders?: readonly BackendPlaceholderInstance[];
  onBackendSnapshotChange?: (snapshot: AgentReviewBackendSnapshot | null) => void;
  children: React.ReactNode;
}

export function ReviewSnapshotProjectProvider({
  projectId,
  taskInstanceId,
  taskLabel,
  backendSnapshot,
  backendPlaceholders = [],
  onBackendSnapshotChange,
  children,
}: ReviewSnapshotProjectProviderProps): React.ReactElement {
  const previousSnapshotRef = React.useRef<AgentReviewBackendSnapshot | null>(
    backendSnapshot ?? null
  );
  const skipHydrateFromSnapshotRef = React.useRef(false);
  const manualEntrySnapshotsByIdRef = React.useRef<
    Map<string, AgentReviewManualBackendEntrySnapshot>
  >(new Map());

  const [data, setData] = React.useState<ProjectData | null>(() => {
    const ctx = buildReviewSnapshotProjectContext({
      projectId,
      taskInstanceId,
      taskLabel,
      backendSnapshot,
    });
    manualEntrySnapshotsByIdRef.current = ctx.manualEntrySnapshotsById;
    return ctx.projectData;
  });

  const [taskWireSyncGen, setTaskWireSyncGen] = React.useState(0);

  React.useEffect(() => {
    if (skipHydrateFromSnapshotRef.current) {
      skipHydrateFromSnapshotRef.current = false;
      previousSnapshotRef.current = backendSnapshot ?? null;
      return;
    }
    const ctx = buildReviewSnapshotProjectContext({
      projectId,
      taskInstanceId,
      taskLabel,
      backendSnapshot,
    });
    manualEntrySnapshotsByIdRef.current = ctx.manualEntrySnapshotsById;
    setData(ctx.projectData);
    previousSnapshotRef.current = backendSnapshot ?? null;
    const disposeTasks = taskRepository.ingestEphemeralTasks(ctx.ephemeralTasks);
    return disposeTasks;
  }, [projectId, taskInstanceId, taskLabel, backendSnapshot]);

  const manualEntriesKey = React.useMemo(
    () => JSON.stringify(data?.backendCatalog?.manualEntries ?? []),
    [data?.backendCatalog?.manualEntries]
  );

  const backendPlaceholdersKey = React.useMemo(
    () => JSON.stringify(backendPlaceholders),
    [backendPlaceholders]
  );

  const manualEntryIds = React.useMemo(
    () => (data?.backendCatalog?.manualEntries ?? []).map((e) => e.id),
    [data?.backendCatalog?.manualEntries]
  );

  React.useEffect(() => {
    const manualEntries = data?.backendCatalog?.manualEntries ?? [];
    const ephemeralTasks = [
      agentTaskStub(taskInstanceId, taskLabel),
      ...manualEntries.map((entry) =>
        resolveEphemeralBackendCallTask(
          entry,
          manualEntrySnapshotsByIdRef.current.get(entry.id)?.taskWire,
          taskRepository.getTask(entry.id)
        )
      ),
    ];
    const disposeTasks = taskRepository.ingestEphemeralTasks(ephemeralTasks);
    return disposeTasks;
  }, [manualEntriesKey, taskInstanceId, taskLabel, data?.backendCatalog?.manualEntries]);

  React.useEffect(() => {
    if (manualEntryIds.length === 0) return;
    let prevKey = backendTaskWireSyncKey(manualEntryIds, (id) => taskRepository.getTask(id));
    const intervalId = window.setInterval(() => {
      const nextKey = backendTaskWireSyncKey(manualEntryIds, (id) => taskRepository.getTask(id));
      if (nextKey !== prevKey) {
        prevKey = nextKey;
        setTaskWireSyncGen((g) => g + 1);
      }
    }, 1200);
    return () => window.clearInterval(intervalId);
  }, [manualEntryIds, manualEntriesKey]);

  React.useEffect(() => {
    if (!onBackendSnapshotChange || !data) return;
    const previousSnapshot = backendSnapshot ?? previousSnapshotRef.current ?? null;
    const next = buildReviewBackendSnapshotFromPortal({
      taskInstanceId,
      taskLabel,
      manualEntries: data.backendCatalog?.manualEntries ?? [],
      backendPlaceholders,
      previousSnapshot,
    });
    if (
      reviewBackendSnapshotsEqual(next, backendSnapshot) ||
      reviewBackendSnapshotsEqual(next, previousSnapshotRef.current)
    ) {
      previousSnapshotRef.current = next;
      return;
    }
    previousSnapshotRef.current = next;
    skipHydrateFromSnapshotRef.current = true;
    if (next?.manualEntries?.length) {
      manualEntrySnapshotsByIdRef.current = new Map(
        next.manualEntries.map((entry) => [entry.id, entry])
      );
    }
    onBackendSnapshotChange(next);
  }, [
    manualEntriesKey,
    backendPlaceholdersKey,
    taskWireSyncGen,
    taskInstanceId,
    taskLabel,
    onBackendSnapshotChange,
    backendSnapshot,
    backendPlaceholders,
  ]);

  const updateDataDirectly = React.useCallback((updatedData: ProjectData) => {
    setData(JSON.parse(JSON.stringify(updatedData)) as ProjectData);
  }, []);

  const updateValue = React.useMemo(
    () => ({
      refreshData: async () => {},
      updateDataDirectly,
      getCurrentProjectId: () => projectId,
      setCurrentProjectId: () => {},
      addCategory: async () => {},
      deleteCategory: async () => {},
      addItem: async () => ({ id: '', name: '', description: '' }),
      deleteItem: async () => {},
      updateItem: async () => {},
    }),
    [projectId, updateDataDirectly]
  );

  const dataValue = React.useMemo(
    () => ({ data, loading: false, error: null }),
    [data]
  );

  return (
    <ProjectDataContext.Provider value={dataValue}>
      <ProjectDataUpdateContext.Provider value={updateValue}>
        {children}
      </ProjectDataUpdateContext.Provider>
    </ProjectDataContext.Provider>
  );
}
