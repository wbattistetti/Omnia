import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useProjectDataUpdate } from './ProjectDataContext';
import { loadProjectTranslations, saveProjectTranslations, loadAllProjectTranslations } from '../services/ProjectDataService';

export interface ProjectTranslationsContextType {
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
  // Original translations loaded from DB (for comparison)
  const [originalTranslations, setOriginalTranslations] = useState<Record<string, string>>({});
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
        // ✅ CRITICAL: Aggiorna immediatamente window.__projectTranslationsContext.translations
        // per accesso sincrono (senza attendere il re-render di React)
        if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
          (window as any).__projectTranslationsContext.translations = updated;
        }
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
      // Save original values for comparison (deep copy)
      setOriginalTranslations(JSON.parse(JSON.stringify(allTranslations)));
      setAllGuids(new Set(Object.keys(allTranslations)));
      setIsDirty(false);
    } catch (err) {
      console.error('[ProjectTranslations] ❌ ERROR loadAllTranslations:', err);
    }
  }, [currentProjectId, projectLocale]);

  // Save all translations to database (explicit save) - only modified ones
  const saveAllTranslations = useCallback(async () => {
    if (!currentProjectId) {
      console.warn('[ProjectTranslations] No project ID, cannot save');
      return;
    }

    if (!isDirty) {
      return;
    }

    try {
      // Compare current translations with original ones to find only modified ones
      const modifiedTranslations: Array<{ guid: string; language: string; text: string; type: string }> = [];

      Object.entries(translations).forEach(([guid, text]) => {
        const originalText = originalTranslations[guid];
        // Include if: new translation (not in original) OR modified (different from original)
        if (originalText === undefined || originalText !== text) {
          modifiedTranslations.push({
            guid,
            language: projectLocale,
            text,
            type: 'Instance'
          });
        }
      });

      if (modifiedTranslations.length === 0) {
        setIsDirty(false);
        return;
      }

      await saveProjectTranslations(currentProjectId, modifiedTranslations);

      // Update original translations with saved values
      const newOriginal = { ...originalTranslations };
      modifiedTranslations.forEach(({ guid, text }) => {
        newOriginal[guid] = text;
      });
      setOriginalTranslations(newOriginal);
      setIsDirty(false);
    } catch (err) {
      console.error('[ProjectTranslations] Error saving translations:', err);
      throw err;
    }
  }, [currentProjectId, translations, originalTranslations, projectLocale, isDirty]);

  // Load translations when project changes
  useEffect(() => {
    if (currentProjectId) {
      // Reset translations when project changes
      setTranslations({});
      setOriginalTranslations({});
      setAllGuids(new Set());
      setIsDirty(false);
      // Load all translations for the project
      loadAllTranslations();
    }
  }, [currentProjectId, loadAllTranslations]);

  // Memoize context value to prevent unnecessary re-renders
  const value: ProjectTranslationsContextType = useMemo(() => ({
    translations,
    addTranslation,
    addTranslations,
    getTranslation,
    loadAllTranslations,
    saveAllTranslations,
    isDirty
  }), [translations, addTranslation, addTranslations, getTranslation, loadAllTranslations, saveAllTranslations, isDirty]);

  // Expose saveAllTranslations, addTranslations, and loadAllTranslations on window for explicit save from AppContent and taskUtils
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__projectTranslationsContext = {
        saveAllTranslations: async () => {
          if (isDirty) {
            await saveAllTranslations();
          }
        },
        addTranslations: (newTranslations: Record<string, string>) => {
          addTranslations(newTranslations);
        },
        loadAllTranslations: async () => {
          await loadAllTranslations();
        },
        isDirty,
        translationsCount: Object.keys(translations).length,
        translations: translations // ✅ CRITICAL: Espone le traduzioni direttamente per accesso sincrono
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__projectTranslationsContext;
      }
    };
  }, [saveAllTranslations, addTranslations, loadAllTranslations, isDirty, translations]);

  return (
    <ProjectTranslationsContext.Provider value={value}>
      {children}
    </ProjectTranslationsContext.Provider>
  );
};

