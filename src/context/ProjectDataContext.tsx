import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ProjectDataService } from '../services/ProjectDataService';
import { normalizeProjectData } from '../utils/normalizers';
import { ProjectData, EntityType, Category, ProjectEntityItem } from '../types/project';

interface ProjectDataContextType {
  data: ProjectData | null;
  loading: boolean;
  error: string | null;
}

interface ProjectDataUpdateContextType {
  refreshData: () => Promise<void>;
  addCategory: (type: EntityType, name: string) => Promise<void>;
  deleteCategory: (type: EntityType, categoryId: string) => Promise<void>;
  updateCategory: (type: EntityType, categoryId: string, updates: Partial<Category>) => Promise<void>;
  addItem: (type: EntityType, categoryId: string, name: string, description?: string, scope?: 'global' | 'industry') => Promise<void>;
  deleteItem: (type: EntityType, categoryId: string, itemId: string) => Promise<void>;
  updateItem: (type: EntityType, categoryId: string, itemId: string, updates: Partial<ProjectEntityItem>) => Promise<void>;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);
const ProjectDataUpdateContext = createContext<ProjectDataUpdateContextType | undefined>(undefined);

export const useProjectData = () => {
  const context = useContext(ProjectDataContext);
  if (context === undefined) {
    throw new Error('useProjectData must be used within a ProjectDataProvider');
  }
  return context;
};

export const useProjectDataUpdate = () => {
  const context = useContext(ProjectDataUpdateContext);
  if (context === undefined) {
    throw new Error('useProjectDataUpdate must be used within a ProjectDataProvider');
  }
  return context;
};

interface ProjectDataProviderProps {
  children: ReactNode;
}

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({ children }) => {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await ProjectDataService.loadProjectData();
      const projectData = normalizeProjectData(raw);
      setData(projectData);
      try { (window as any).__projectData = projectData; } catch {}
    } catch (err) {
      console.warn('Failed to load project data:', err);
      // Inizializza con dati vuoti se non c'è un progetto corrente
      const fallbackData = {
        name: '',
        industry: '',
        agentActs: [],
        userActs: [],
        backendActions: [],
        tasks: [],
        conditions: [],
        macroTasks: []
      };
      setData(fallbackData);
      try { (window as any).__projectData = fallbackData as any; } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async () => {
    await loadData();
  };

  const addCategory = async (type: EntityType, name: string) => {
    try {
      await ProjectDataService.addCategory(type, name);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const deleteCategory = async (type: EntityType, categoryId: string) => {
    try {
      await ProjectDataService.deleteCategory(type, categoryId);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const updateCategory = async (type: EntityType, categoryId: string, updates: Partial<Category>) => {
    try {
      await ProjectDataService.updateCategory(type, categoryId, updates);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    }
  };

  const addItem = async (type: EntityType, categoryId: string, name: string, description = '', scope?: 'global' | 'industry') => {
    try {
      await ProjectDataService.addItem(type, categoryId, name, description, scope);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const deleteItem = async (type: EntityType, categoryId: string, itemId: string) => {
    try {
      await ProjectDataService.deleteItem(type, categoryId, itemId);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const updateItem = async (type: EntityType, categoryId: string, itemId: string, updates: Partial<ProjectEntityItem>) => {
    try {
      await ProjectDataService.updateItem(type, categoryId, itemId, updates);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const contextValue: ProjectDataContextType = {
    data,
    loading,
    error
  };

  const updateContextValue: ProjectDataUpdateContextType = {
    refreshData,
    addCategory,
    deleteCategory,
    updateCategory,
    addItem,
    deleteItem,
    updateItem
  };

  return (
    <ProjectDataContext.Provider value={contextValue}>
      <ProjectDataUpdateContext.Provider value={updateContextValue}>
        {children}
      </ProjectDataUpdateContext.Provider>
    </ProjectDataContext.Provider>
  );
};