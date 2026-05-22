/**
 * Isolated ProjectData context for the review portal — uses the same React contexts as Omnia.
 */

import React from 'react';
import type { ProjectData } from '@types/project';
import { taskRepository } from '@services/TaskRepository';
import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import {
  ProjectDataContext,
  ProjectDataUpdateContext,
} from '@context/ProjectDataContext';
import { buildReviewSnapshotProjectContext } from './mapReviewSnapshotToProjectContext';

export interface ReviewSnapshotProjectProviderProps {
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  backendSnapshot: AgentReviewBackendSnapshot | null | undefined;
  children: React.ReactNode;
}

export function ReviewSnapshotProjectProvider({
  projectId,
  taskInstanceId,
  taskLabel,
  backendSnapshot,
  children,
}: ReviewSnapshotProjectProviderProps): React.ReactElement {
  const [data, setData] = React.useState<ProjectData | null>(() =>
    buildReviewSnapshotProjectContext({
      projectId,
      taskInstanceId,
      taskLabel,
      backendSnapshot,
    }).projectData
  );

  React.useEffect(() => {
    const ctx = buildReviewSnapshotProjectContext({
      projectId,
      taskInstanceId,
      taskLabel,
      backendSnapshot,
    });
    setData(ctx.projectData);
    const disposeTasks = taskRepository.ingestEphemeralTasks(ctx.ephemeralTasks);
    return disposeTasks;
  }, [projectId, taskInstanceId, taskLabel, backendSnapshot]);

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
      updateCategory: async () => {},
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
