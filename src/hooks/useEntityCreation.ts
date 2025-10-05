import { useCallback } from 'react';
import { EntityCreationService, EntityCreationOptions } from '../services/EntityCreationService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';

export interface UseEntityCreationReturn {
  createAgentAct: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => Promise<void>;
  createBackendCall: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => Promise<void>;
  createTask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => Promise<void>;
}

/**
 * Hook personalizzato per la creazione di entità (Agent Acts, Backend Calls, Tasks)
 * Centralizza la logica di creazione e fornisce un'interfaccia pulita
 */
export const useEntityCreation = (): UseEntityCreationReturn => {
  const projectDataContext = useProjectData();
  const projectDataUpdateContext = useProjectDataUpdate();
  
  // Controlla se i context sono disponibili
  if (!projectDataContext || !projectDataUpdateContext) {
    throw new Error('useEntityCreation must be used within ProjectDataProvider');
  }
  
  const { data: projectData } = projectDataContext;
  const { addCategory, updateItem } = projectDataUpdateContext;

  const createEntity = useCallback(async (
    entityType: 'agentActs' | 'backendActions' | 'tasks',
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry'
  ) => {
    const options: EntityCreationOptions = {
      name,
      onRowUpdate,
      projectData,
      addCategory,
      updateItem,
      projectIndustry: projectData?.industry as any,
      scope
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

  const createAgentAct = useCallback(async (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => {
    await createEntity('agentActs', name, onRowUpdate, scope);
  }, [createEntity]);

  const createBackendCall = useCallback(async (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => {
    await createEntity('backendActions', name, onRowUpdate, scope);
  }, [createEntity]);

  const createTask = useCallback(async (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry') => {
    await createEntity('tasks', name, onRowUpdate, scope);
  }, [createEntity]);

  return {
    createAgentAct,
    createBackendCall,
    createTask
  };
};
