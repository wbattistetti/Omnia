import { useCallback } from 'react';
import { EntityCreationService, EntityCreationOptions } from '../services/EntityCreationService';
import { useProjectData } from '../context/ProjectDataContext';
import { useProjectDataUpdate } from '../context/ProjectDataContext';

import { TaskType } from '../types/taskTypes'; // ✅ Import TaskType enum

export interface UseEntityCreationReturn {
  createFactoryTask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string, type?: TaskType) => void; // ✅ RINOMINATO: createAgentAct → createFactoryTask
  createBackendCall: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  createMacrotask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  createCondition: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  // @deprecated Use createMacrotask instead
  createTask: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

/**
 * Hook personalizzato per la creazione di entità (Factory Tasks, Backend Calls, Tasks)
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
  const { refreshData, updateDataDirectly } = projectDataUpdateContext;

  const createEntity = useCallback((
    entityType: 'taskTemplates' | 'backendActions' | 'macrotasks' | 'conditions',
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string,
    type?: string
  ) => {
    try { console.log('[CreateAct][hook][enter]', { entityType, name, scope, hasOnRowUpdate: !!onRowUpdate, categoryName, type }); } catch { }
    const options: EntityCreationOptions = {
      name,
      onRowUpdate, // ✅ Pass callback to service
      projectData,
      projectIndustry: projectData?.industry as any,
      scope,
      categoryName,
      type: type as any
    };

    let result;
    switch (entityType) {
      case 'taskTemplates':
        result = EntityCreationService.createTaskTemplate(options);
        break;
      case 'backendActions':
        result = EntityCreationService.createBackendCall(options);
        break;
      case 'macrotasks':
        result = EntityCreationService.createMacrotask(options);
        break;
      case 'conditions':
        result = EntityCreationService.createCondition(options);
        break;
      default:
        console.error(`Unknown entity type: ${entityType}`);
        return;
    }

    // ✅ Aggiorna il context direttamente con i dati modificati (preserva items in memoria)
    if (result) {
      try { console.log('[CreateAct][hook][result]', { id: (result as any)?.id, type: (result as any)?.type, mode: (result as any)?.mode }); } catch { }
      // ✅ Aggiorna direttamente i dati senza ricaricare dal DB (così gli items in memoria restano visibili)
      if (projectData) {
        updateDataDirectly({ ...projectData }); // Crea nuova reference per forzare re-render
      }
    }
  }, [projectData, updateDataDirectly]);

  const createFactoryTask = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string, type?: TaskType) => {
    // ✅ Converti TaskType enum → string per backward compatibility temporanea con EntityCreationService
    const typeString = type !== undefined ? TaskType[type] : undefined;
    createEntity('taskTemplates', name, onRowUpdate, scope, categoryName, typeString);
  }, [createEntity]);

  const createBackendCall = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createEntity('backendActions', name, onRowUpdate, scope, categoryName);
  }, [createEntity]);

  const createMacrotask = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createEntity('macrotasks', name, onRowUpdate, scope, categoryName);
  }, [createEntity]);

  // @deprecated Use createMacrotask instead
  const createTask = useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
    createMacrotask(name, onRowUpdate, scope, categoryName);
  }, [createMacrotask]);

  return {
    createFactoryTask, // ✅ RINOMINATO: createAgentAct → createFactoryTask
    createBackendCall,
    createMacrotask,
    createCondition: useCallback((name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => {
      createEntity('conditions', name, onRowUpdate, scope, categoryName);
    }, [createEntity]),
    createTask // @deprecated
  };
};
