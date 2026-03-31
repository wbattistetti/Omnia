import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { useProjectDataUpdate } from './ProjectDataContext';
import { loadProjectTranslations, saveProjectTranslations, loadAllProjectTranslations } from '../services/ProjectDataService';
import { notifyTranslationAdded, notifyTranslationsAdded } from '../utils/translationTracker';

export interface ProjectTranslationsContextType {
  // Global translations table: { guid: text } where text is for project locale only
  translations: Record<string, string>;
  // Add translation to global table (in memory only)
  addTranslation: (guid: string, text: string, templateId?: string) => void;
  // Add multiple translations to global table (in memory only)
  addTranslations: (translations: Record<string, string>, templateId?: string) => void;
  // Get translation by GUID
  getTranslation: (guid: string) => string | undefined;
  // Load all project translations from database
  loadAllTranslations: () => Promise<void>;
  // Save all translations to database (explicit save)
  saveAllTranslations: () => Promise<void>;
  // Check if translations are dirty (have unsaved changes)
  isDirty: boolean;
  /** True while a load from persistence is in flight. */
  isLoading: boolean;
  /**
   * True once the initial load for the current project has settled (success or failure).
   * Missing keys for new tasks are normal — this does not mean “every string exists in DB”.
   */
  isReady: boolean;
  // ✅ NEW: Set current template ID for translation tracking
  setCurrentTemplateId: (templateId: string | null) => void;
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
  // ✅ NEW: Track current template ID for translation tracking
  const [currentTemplateId, setCurrentTemplateIdState] = useState<string | null>(null);

  // ✅ FIX: Live ref for synchronous access to translations (updated immediately, not waiting for React render)
  // This solves the timing issue where cloneAndContextualizeTranslations reads translations
  // before React state has updated (during wizard pipeline execution)
  const translationsLiveRef = useRef<Record<string, string>>({});

  // ✅ Keep ref in sync with state (for DB loads and initial state)
  useEffect(() => {
    translationsLiveRef.current = translations;
  }, [translations]);

  // ✅ NEW: Set current template ID for translation tracking
  const setCurrentTemplateId = useCallback((templateId: string | null) => {
    setCurrentTemplateIdState(templateId);
    console.log('[ProjectTranslations] 📌 Current template ID set', { templateId });
  }, []);

  // Add translation to global table (in memory only)
  const addTranslation = useCallback((guid: string, text: string, templateId?: string) => {
    if (!guid) return;

    // Use provided templateId or current templateId
    const activeTemplateId = templateId || currentTemplateId;

    // ✅ FIX: Update ref SYNCHRONOUSLY (immediate, no React render wait)
    // This ensures cloneAndContextualizeTranslations can read translations immediately
    // during wizard pipeline execution, before React state has updated
    translationsLiveRef.current = { ...translationsLiveRef.current, [guid]: text };

    // ⏳ ASYNC: React state update (for UI re-render and context value)
    setTranslations((prev) => {
      if (prev[guid] === text) return prev; // No change
      setIsDirty(true);
      return { ...prev, [guid]: text };
    });
    setAllGuids((prev) => new Set([...prev, guid]));

    // ✅ EVENT-DRIVEN: Notify translation tracker if we have a templateId
    if (activeTemplateId) {
      notifyTranslationAdded(activeTemplateId, guid);
    }
  }, [currentTemplateId]);

  // Add multiple translations to global table (in memory only)
  const addTranslations = useCallback((newTranslations: Record<string, string>, templateId?: string) => {
    // Use provided templateId or current templateId
    const activeTemplateId = templateId || currentTemplateId;

    // ✅ FIX: Update ref SYNCHRONOUSLY (immediate, no React render wait)
    translationsLiveRef.current = { ...translationsLiveRef.current, ...newTranslations };

    // ⏳ ASYNC: React state update (for UI re-render and context value)
    setTranslations((prev) => {
      let hasChanges = false;
      const updated = { ...prev };
      Object.entries(newTranslations).forEach(([guid, text]) => {
        if (guid && updated[guid] !== text) {
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

    // ✅ EVENT-DRIVEN: Notify translation tracker if we have a templateId
    if (activeTemplateId) {
      notifyTranslationsAdded(activeTemplateId, Object.keys(newTranslations));
    }
  }, [currentTemplateId]);

  // Get translation by GUID (prefer live ref so readers see values written in the same tick as addTranslation)
  const getTranslation = useCallback((guid: string): string | undefined => {
    const live = translationsLiveRef.current[guid];
    if (live !== undefined) return live;
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
      setLoadedTranslations(null);
      // Fail-open: initial load attempt finished (with error). Empty/partial in-memory map is valid;
      // UI must not wait forever (e.g. new tasks have no DB keys yet).
      setLoadingCompleted(true);
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
    isReady, // ✅ NEW
    setCurrentTemplateId // ✅ NEW
  }), [translations, addTranslation, addTranslations, getTranslation, loadAllTranslations, saveAllTranslations, isDirty, isLoading, isReady, setCurrentTemplateId]);

  // Expose saveAllTranslations, addTranslations, and loadAllTranslations on window for explicit save from AppContent and taskUtils
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // ✅ CRITICAL: Use Object.defineProperty to create a getter that always reads from current React state
      // This ensures that when DDEBubbleChat reads translations during compilation, it always gets the latest value
      Object.defineProperty((window as any), '__projectTranslationsContext', {
        value: {
          saveAllTranslations: async () => {
            if (isDirty) {
              await saveAllTranslations();
            }
          },
          addTranslations: (newTranslations: Record<string, string>, templateId?: string) => {
            addTranslations(newTranslations, templateId);
          },
          addTranslation: (guid: string, text: string, templateId?: string) => {
            addTranslation(guid, text, templateId);
          },
          setCurrentTemplateId: (templateId: string | null) => {
            setCurrentTemplateId(templateId);
          },
          loadAllTranslations: async () => {
            await loadAllTranslations();
          },
          get isDirty() {
            return isDirty;
          },
          get translationsCount() {
            return Object.keys(translations).length;
          },
          get translations() {
            // ✅ FIX: Read from live ref (updated synchronously in addTranslation/addTranslations)
            // instead of React state closure (stale during wizard pipeline execution)
            // This ensures cloneAndContextualizeTranslations can read translations immediately
            // after they are added during AIGenerateTemplateMessages, before React re-render
            return translationsLiveRef.current;
          }
        },
        writable: true,
        configurable: true
      });
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__projectTranslationsContext;
      }
    };
  }, [saveAllTranslations, addTranslations, addTranslation, loadAllTranslations, isDirty, translations, setCurrentTemplateId]);

  return (
    <ProjectTranslationsContext.Provider value={value}>
      {children}
    </ProjectTranslationsContext.Provider>
  );
};

