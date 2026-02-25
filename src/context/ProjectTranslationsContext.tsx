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
  // ✅ NEW: Loading state - indicates if translations are currently being loaded
  isLoading: boolean;
  // ✅ NEW: Ready state - indicates if translations have been loaded and are ready to use
  isReady: boolean;
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
  // ✅ NEW: Loading and ready states for translations
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Add translation to global table (in memory only)
  const addTranslation = useCallback((guid: string, text: string) => {
    if (!guid || !text) return;
    setTranslations((prev) => {
      if (prev[guid] === text) return prev; // No change
      setIsDirty(true);
      const updated = { ...prev, [guid]: text };
      // ✅ CRITICAL: Aggiorna immediatamente window.__projectTranslationsContext.translations
      // per accesso sincrono (senza attendere il re-render di React)
      if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
        (window as any).__projectTranslationsContext.translations = updated;
      }
      return updated;
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

  // ✅ Track loading completion to set isReady after translations state is updated
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, string> | null>(null);

  // ✅ Set isReady only after translations state is updated (via useEffect)
  useEffect(() => {
    if (loadingCompleted && !isLoading) {
      // Loading completed and translations state has been updated
      setIsReady(true);
      setLoadingCompleted(false);
      setLoadedTranslations(null);

      // ✅ DEBUG: Verifica che le traduzioni siano state caricate
      console.log('[ProjectTranslations] ✅ Translations ready', {
        projectId: currentProjectId,
        locale: projectLocale,
        totalTranslations: Object.keys(translations).length,
        sampleGuids: Object.keys(translations).slice(0, 10)
      });
    }
  }, [loadingCompleted, isLoading, translations, currentProjectId, projectLocale]);

  // Load all project translations from database
  const loadAllTranslations = useCallback(async () => {
    if (!currentProjectId) {
      setIsReady(false);
      return;
    }

    setIsLoading(true);
    setIsReady(false);
    setLoadingCompleted(false);

    try {
      const allTranslations = await loadAllProjectTranslations(currentProjectId, projectLocale);
      // ✅ CRITICAL: Merge instead of replace to preserve in-memory translations (e.g., template translations not yet in DB)
      setTranslations((prev) => {
        const merged = { ...prev, ...allTranslations };
        // Update allGuids to include both existing and new GUIDs
        setAllGuids(new Set([...Object.keys(prev), ...Object.keys(allTranslations)]));
        return merged;
      });
      // Save original values for comparison (deep copy)
      setOriginalTranslations(JSON.parse(JSON.stringify(allTranslations)));
      setIsDirty(false);

      // ✅ Mark loading as completed - isReady will be set by useEffect after translations state updates
      setLoadedTranslations(allTranslations);
      setLoadingCompleted(true);

      // ✅ DEBUG: Verifica che le traduzioni Factory siano state caricate
      console.log('[ProjectTranslations] 🔍 VERIFICA TRADUZIONI CARICATE', {
        projectId: currentProjectId,
        locale: projectLocale,
        totalTranslations: Object.keys(allTranslations).length,
        sampleGuids: Object.keys(allTranslations).slice(0, 10),
        // ✅ Verifica se ci sono traduzioni Factory (quelle senza projectId specifico)
        // Nota: Le traduzioni Factory vengono caricate dal backend insieme alle traduzioni del progetto
        translationsSample: Object.entries(allTranslations).slice(0, 3).map(([guid, text]) => ({
          guid,
          textPreview: typeof text === 'string' ? text.substring(0, 50) : String(text).substring(0, 50)
        }))
      });
    } catch (err) {
      console.error('[ProjectTranslations] ❌ ERROR loadAllTranslations:', err);
      setIsReady(false);
      setLoadingCompleted(false);
      setLoadedTranslations(null);
    } finally {
      setIsLoading(false);
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
  // ✅ CRITICAL: Only reset if project actually changed, not on every loadAllTranslations change
  const prevProjectIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (currentProjectId) {
      const projectChanged = prevProjectIdRef.current !== currentProjectId;

      if (projectChanged) {
        // Only reset when project actually changes
        prevProjectIdRef.current = currentProjectId;
        setTranslations({});
        setOriginalTranslations({});
        setAllGuids(new Set());
        setIsDirty(false);
        setIsReady(false); // ✅ Reset ready state when project changes
        // Load all translations for the project
        console.log('[ProjectTranslations] 🔄 Project changed, loading translations', {
          projectId: currentProjectId,
          locale: projectLocale
        });
        loadAllTranslations();
      }
      // ✅ DO NOT reset if project hasn't changed - preserve in-memory translations
      // ✅ BUT: If translations are empty and not loading, try to load them
      else if (Object.keys(translations).length === 0 && !isLoading && !isReady) {
        console.log('[ProjectTranslations] 🔄 Translations empty but project unchanged, loading translations', {
          projectId: currentProjectId,
          locale: projectLocale
        });
        loadAllTranslations();
      }
    } else {
      prevProjectIdRef.current = null;
      setIsReady(false);
    }
  }, [currentProjectId, translations, isLoading, isReady, projectLocale, loadAllTranslations]); // ✅ Added dependencies to check if translations need to be loaded

  // Memoize context value to prevent unnecessary re-renders
  const value: ProjectTranslationsContextType = useMemo(() => ({
    translations,
    addTranslation,
    addTranslations,
    getTranslation,
    loadAllTranslations,
    saveAllTranslations,
    isDirty,
    isLoading, // ✅ NEW
    isReady // ✅ NEW
  }), [translations, addTranslation, addTranslations, getTranslation, loadAllTranslations, saveAllTranslations, isDirty, isLoading, isReady]);

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

