import { useCallback } from 'react';
import { EntityCreationService, EntityCreationOptions } from '../services/EntityCreationService';
import { useProjectData } from '../context/ProjectDataContext';
import { useProjectDataUpdate } from '../context/ProjectDataContext';

export interface UseEntityCreationReturn {
  createAgentAct: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  createBackendCall: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  createTask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  createCondition: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

/**
 * Hook personalizzato per la creazione di entità (Agent Acts, Backend Calls, Tasks)
 * Centralizza la logica di creazione e fornisce un'interfaccia pulita
 */
export const useEntityCreation = (): UseEntityCreationReturn => {
  const projectDataContext = useProjectData();
  const projectDataUpdateContext = useProjectDataUpdate();
  
  // Controlla se il context è disponibile
  if (!projectDataContext || !projectDataUpdateContext) {
    throw new Error('useEntityCreation must be used within ProjectDataProvider');
  }
  
  const { data: projectData } = projectDataContext;
  const { refreshData } = projectDataUpdateContext;

  const createEntity = useCallback((
    entityType: 'agentActs' | 'backendActions' | 'tasks' | 'conditions',
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string
  ) => {
    try { console.log('[CreateAct][hook][enter]', { entityType, name, hasOnRowUpdate: !!onRowUpdate, scope, categoryName }); } catch {}
    const options: EntityCreationOptions = {
      name,
      onRowUpdate,
      projectData,
      projectIndustry: projectData?.industry as any,
      scope,
      categoryName
    };

    let result;
    switch (entityType) {
      case 'agentActs':
        result = EntityCreationService.createAgentAct(options);
        break;
      case 'backendActions':
        result = EntityCreationService.createBackendCall(options);
        break;
      case 'tasks':
        result = EntityCreationService.createTask(options);
        break;
      case 'conditions':
        result = EntityCreationService.createCondition(options);
        break;
      default:
        console.error(`Unknown entity type: ${entityType}`);
        return;
    }

    // Aggiorna il context per riflettere le modifiche nel sidebar
    if (result) {
      try { console.log('[CreateAct][hook][result]', { id: (result as any)?.id, type: (result as any)?.type, mode: (result as any)?.mode }); } catch {}
      console.log('🔄 Refreshing project data after entity creation');
      refreshData();
    }
  }, [projectData, refreshData]);

  const createAgentAct = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createEntity('agentActs', name, onRowUpdate, scope, categoryName);
  }, [createEntity]);

  const createBackendCall = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createEntity('backendActions', name, onRowUpdate, scope, categoryName);
  }, [createEntity]);

  const createTask = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createEntity('tasks', name, onRowUpdate, scope, categoryName);
  }, [createEntity]);

  return {
    createAgentAct,
    createBackendCall,
    createTask,
    createCondition: useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
      createEntity('conditions', name, onRowUpdate, scope, categoryName);
    }, [createEntity])
  };
};
