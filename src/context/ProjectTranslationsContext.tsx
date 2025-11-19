import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useProjectDataUpdate } from './ProjectDataContext';
import { loadProjectTranslations, saveProjectTranslations, loadAllProjectTranslations } from '../services/ProjectDataService';

interface ProjectTranslationsContextType {
  // Global translations table: { guid: text } where text is for project locale only
  translations: Record<string, string>;
  // Add translation to global table (in memory only)
  addTranslation: (guid: string, text: string) => void;
  // Add multiple translations to global table (in memory only)
  addTranslations: (translations: Record<string, string>) => void;
  // Get translation by GUID
  getTranslation: (guid: string) => string | undefined;
  // Load all project translations from database
  loadAllTranslations: () => Promise<void>;
  // Save all translations to database (explicit save)
  saveAllTranslations: () => Promise<void>;
  // Check if translations are dirty (have unsaved changes)
  isDirty: boolean;
}

const ProjectTranslationsContext = createContext<ProjectTranslationsContextType | undefined>(undefined);

export const useProjectTranslations = () => {
  const context = useContext(ProjectTranslationsContext);
  if (context === undefined) {
    throw new Error('useProjectTranslations must be used within a ProjectTranslationsProvider');
  }
  return context;
};

interface ProjectTranslationsProviderProps {
  children: ReactNode;
}

export const ProjectTranslationsProvider: React.FC<ProjectTranslationsProviderProps> = ({ children }) => {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;

  // Get project locale
  const projectLocale = (() => {
    try {
      return (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
    } catch {
      return 'pt';
    }
  })();

  // Global translations table: { guid: text } where text is for project locale only
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [allGuids, setAllGuids] = useState<Set<string>>(new Set());

  // Add translation to global table (in memory only)
  const addTranslation = useCallback((guid: string, text: string) => {
    if (!guid || !text) return;
    setTranslations((prev) => {
      if (prev[guid] === text) return prev; // No change
      setIsDirty(true);
      return { ...prev, [guid]: text };
    });
    setAllGuids((prev) => new Set([...prev, guid]));
  }, []);

  // Add multiple translations to global table (in memory only)
  const addTranslations = useCallback((newTranslations: Record<string, string>) => {
    setTranslations((prev) => {
      let hasChanges = false;
      const updated = { ...prev };
      Object.entries(newTranslations).forEach(([guid, text]) => {
        if (guid && text && updated[guid] !== text) {
          updated[guid] = text;
          hasChanges = true;
        }
      });
      if (hasChanges) {
        setIsDirty(true);
        setAllGuids((prev) => new Set([...prev, ...Object.keys(newTranslations)]));
      }
      return updated;
    });
  }, []);

  // Get translation by GUID
  const getTranslation = useCallback((guid: string): string | undefined => {
    return translations[guid];
  }, [translations]);

  // Load all project translations from database
  const loadAllTranslations = useCallback(async () => {
    if (!currentProjectId) {
      return;
    }

    try {
      const allTranslations = await loadAllProjectTranslations(currentProjectId, projectLocale);
      setTranslations(allTranslations);
      setAllGuids(new Set(Object.keys(allTranslations)));
      setIsDirty(false);
    } catch (err) {
      console.error('[ProjectTranslations] Error loading translations:', err);
    }
  }, [currentProjectId, projectLocale]);

  // Save all translations to database (explicit save)
  const saveAllTranslations = useCallback(async () => {
    if (!currentProjectId) {
      console.warn('[ProjectTranslations] No project ID, cannot save');
      return;
    }

    if (!isDirty) {
      return;
    }

    try {
      // Convert to array format for saveProjectTranslations
      const translationsToSave = Object.entries(translations).map(([guid, text]) => ({
        guid,
        language: projectLocale,
        text,
        type: 'Instance'
      }));

      await saveProjectTranslations(currentProjectId, translationsToSave);
      setIsDirty(false);
    } catch (err) {
      console.error('[ProjectTranslations] Error saving translations:', err);
      throw err;
    }
  }, [currentProjectId, translations, projectLocale, isDirty]);

  // Load translations when project changes
  useEffect(() => {
    if (currentProjectId) {
      // Reset translations when project changes
      setTranslations({});
      setAllGuids(new Set());
      setIsDirty(false);
      // Load all translations for the project
      loadAllTranslations();
    }
  }, [currentProjectId, loadAllTranslations]);

  const value: ProjectTranslationsContextType = {
    translations,
    addTranslation,
    addTranslations,
    getTranslation,
    loadAllTranslations,
    saveAllTranslations,
    isDirty
  };

  // Expose saveAllTranslations on window for explicit save from AppContent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__projectTranslationsContext = {
        saveAllTranslations: async () => {
          if (isDirty) {
            await saveAllTranslations();
          } else {
            console.log('[ProjectTranslations] No changes to save (isDirty: false)');
          }
        },
        isDirty,
        translationsCount: Object.keys(translations).length
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__projectTranslationsContext;
      }
    };
  }, [saveAllTranslations, isDirty, translations]);

  return (
    <ProjectTranslationsContext.Provider value={value}>
      {children}
    </ProjectTranslationsContext.Provider>
  );
};

