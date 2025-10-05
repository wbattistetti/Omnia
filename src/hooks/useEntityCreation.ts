import { useCallback } from 'react';
import { EntityCreationService, EntityCreationOptions } from '../services/EntityCreationService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';

export interface UseEntityCreationReturn {
  createAgentAct: (name: string, onRowUpdate?: (item: any) => void) => Promise<void>;
  createBackendCall: (name: string, onRowUpdate?: (item: any) => void) => Promise<void>;
  createTask: (name: string, onRowUpdate?: (item: any) => void) => Promise<void>;
}

/**
 * Hook personalizzato per la creazione di entità (Agent Acts, Backend Calls, Tasks)
 * Centralizza la logica di creazione e fornisce un'interfaccia pulita
 */
export const useEntityCreation = (): UseEntityCreationReturn => {
  const { data: projectData } = useProjectData();
  const { addCategory, updateItem } = useProjectDataUpdate();

  const createEntity = useCallback(async (
    entityType: 'agentActs' | 'backendActions' | 'tasks',
    name: string,
    onRowUpdate?: (item: any) => void
  ) => {
    const options: EntityCreationOptions = {
      name,
      onRowUpdate,
      projectData,
      addCategory,
      updateItem
    };

    switch (entityType) {
      case 'agentActs':
        await EntityCreationService.createAgentAct(options);
        break;
      case 'backendActions':
        await EntityCreationService.createBackendCall(options);
        break;
      case 'tasks':
        await EntityCreationService.createTask(options);
        break;
      default:
        console.error(`Unknown entity type: ${entityType}`);
    }
  }, [projectData, addCategory, updateItem]);

  const createAgentAct = useCallback(async (name: string, onRowUpdate?: (item: any) => void) => {
    await createEntity('agentActs', name, onRowUpdate);
  }, [createEntity]);

  const createBackendCall = useCallback(async (name: string, onRowUpdate?: (item: any) => void) => {
    await createEntity('backendActions', name, onRowUpdate);
  }, [createEntity]);

  const createTask = useCallback(async (name: string, onRowUpdate?: (item: any) => void) => {
    await createEntity('tasks', name, onRowUpdate);
  }, [createEntity]);

  return {
    createAgentAct,
    createBackendCall,
    createTask
  };
};
