/**
 * Global project translation map: load (factory+project merge from API), snapshot after load for
 * flow-key materialization, bulk save split by deterministic project vs factory classification.
 * Keys present only in FlowDocument.meta.translations (workspace flow slices) are not written to
 * the global translations API — they persist via PUT flow-document.
 */
import React, { useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import {
  ProjectTranslationsContext,
  type ProjectTranslationsContextType,
  isProjectTranslationsDebugEnabled,
} from './projectTranslationsContextInstance';
import { useProjectDataUpdate } from './ProjectDataContext';
import { loadAllProjectTranslations, saveAllTranslationsBulk } from '../services/ProjectDataService';
import { notifyTranslationAdded, notifyTranslationsAdded } from '../utils/translationTracker';
import { setProjectTranslationsRegistry } from '../utils/projectTranslationsRegistry';
import { registerVariableTranslationListener } from '../utils/variableTranslationBridge';
import { isValidTranslationStoreKey, parseTranslationKey, translationKeyFromStoredValue } from '../utils/translationKeys';
import { extractGUIDsFromDDT } from '../utils/ddtUtils';
import { taskRepository } from '../services/TaskRepository';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TemplateSource } from '../types/taskTypes';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import { collectFlowLocalTranslationKeysFromWorkspace } from '../utils/flowLocalTranslationKeys';
import type { FlowNode } from '../components/Flowchart/types/flowTypes';

export type { ProjectTranslationsContextType } from './projectTranslationsContextInstance';
export { useProjectTranslations, isProjectTranslationsDebugEnabled } from './projectTranslationsContextInstance';

interface ProjectTranslationsProviderProps {
  children: ReactNode;
}

/** Extract `task:...` keys from persisted steps dictionary (same shape as DDT `steps`). */
function extractTaskKeysFromStepsObject(
  steps: Record<string, Record<string, any>> | undefined | null
): string[] {
  const guids = new Set<string>();
  if (!steps || typeof steps !== 'object') return [];
  Object.values(steps).forEach((nodeSteps) => {
    if (!nodeSteps || typeof nodeSteps !== 'object') return;
    Object.values(nodeSteps).forEach((step: any) => {
      if (!step?.escalations || !Array.isArray(step.escalations)) return;
      step.escalations.forEach((esc: any) => {
        (esc?.tasks || []).forEach((task: any) => {
          const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
          const tk = textParam?.value ? translationKeyFromStoredValue(String(textParam.value)) : null;
          if (tk) guids.add(tk);
        });
      });
    });
  });
  return Array.from(guids);
}

function collectKeysFromPersistedTask(task: any): string[] {
  const keys = new Set<string>();
  const params = task.parameters;
  if (Array.isArray(params)) {
    for (const p of params) {
      if (p?.parameterId === 'text' && p?.value) {
        const tk = translationKeyFromStoredValue(String(p.value));
        if (tk) keys.add(tk);
      }
    }
  }
  if (task.subTasks && Array.isArray(task.subTasks) && task.subTasks.length > 0) {
    extractGUIDsFromDDT({ nodes: task.subTasks }).forEach((k) => keys.add(k));
  }
  extractTaskKeysFromStepsObject(task.steps).forEach((k) => keys.add(k));
  return Array.from(keys);
}

/**
 * FLOW_KEYS: every `task:...` key referenced from task tree (steps/subtasks), DDT-shaped task
 * fragments, and flowchart rows (task id per row).
 */
function collectFlowTaskTranslationKeys(): string[] {
  const keys = new Set<string>();
  for (const task of taskRepository.getAllTasks()) {
    collectKeysFromPersistedTask(task).forEach((k) => keys.add(k));
  }
  const flowIds = FlowWorkspaceSnapshot.getAllFlowIds();
  for (const fid of flowIds) {
    const flow = FlowWorkspaceSnapshot.getFlowById(fid);
    if (!flow?.nodes) continue;
    for (const n of flow.nodes) {
      const data = n.data as FlowNode | undefined;
      const rows = data?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const tid = row?.id;
        if (!tid) continue;
        const t = taskRepository.getTask(tid);
        if (t) {
          collectKeysFromPersistedTask(t).forEach((k) => keys.add(k));
        }
      }
    }
  }
  return Array.from(keys).filter((k) => parseTranslationKey(k)?.kind === 'task');
}

function classifyTranslationKeyDestination(key: string): 'project' | 'factory' {
  if (key.startsWith('runtime.')) return 'project';
  const parsed = parseTranslationKey(key);
  if (!parsed || parsed.kind !== 'task') return 'project';
  const uuid = parsed.guid;
  if (taskRepository.hasTask(uuid)) return 'project';
  const tpl = DialogueTaskService.getTemplate(uuid);
  if (tpl) {
    return tpl.source === TemplateSource.Factory ? 'factory' : 'project';
  }
  return 'project';
}

export const ProjectTranslationsProvider: React.FC<ProjectTranslationsProviderProps> = ({ children }) => {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;

  const projectLocale = (() => {
    try {
      return (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';
    } catch {
      return 'pt';
    }
  })();

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTemplateId, setCurrentTemplateIdState] = useState<string | null>(null);

  const translationsLiveRef = useRef<Record<string, string>>({});
  /** Copy of merged load result; used only to materialize missing flow keys before save. */
  const snapshotAfterLoadRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isProjectTranslationsDebugEnabled()) {
      console.debug('[ProjectTranslations] Provider montato', { providerModuleUrl: import.meta.url });
    }
    return () => {
      if (isProjectTranslationsDebugEnabled()) {
        console.debug('[ProjectTranslations] Provider smontato');
      }
    };
  }, []);

  useEffect(() => {
    translationsLiveRef.current = translations;
  }, [translations]);

  const setCurrentTemplateId = useCallback((templateId: string | null) => {
    setCurrentTemplateIdState(templateId);
  }, []);

  const addTranslation = useCallback((guid: string, text: string, templateId?: string) => {
    if (!guid) return;
    if (!isValidTranslationStoreKey(guid)) {
      throw new Error(`[ProjectTranslations] Invalid translation store key (expected kind:uuid or runtime.*): ${guid}`);
    }

    const activeTemplateId = templateId || currentTemplateId;

    translationsLiveRef.current = { ...translationsLiveRef.current, [guid]: text };
    setProjectTranslationsRegistry(translationsLiveRef.current);

    setTranslations((prev) => {
      if (prev[guid] === text) return prev;
      return { ...prev, [guid]: text };
    });

    if (activeTemplateId) {
      notifyTranslationAdded(activeTemplateId, guid);
    }
  }, [currentTemplateId]);

  const addTranslations = useCallback((newTranslations: Record<string, string>, templateId?: string) => {
    const activeTemplateId = templateId || currentTemplateId;

    Object.keys(newTranslations).forEach((k) => {
      if (k && !isValidTranslationStoreKey(k)) {
        throw new Error(`[ProjectTranslations] Invalid translation store key (expected kind:uuid or runtime.*): ${k}`);
      }
    });

    translationsLiveRef.current = { ...translationsLiveRef.current, ...newTranslations };
    setProjectTranslationsRegistry(translationsLiveRef.current);

    setTranslations((prev) => {
      let hasChanges = false;
      const updated = { ...prev };
      Object.entries(newTranslations).forEach(([guid, text]) => {
        if (guid && updated[guid] !== text) {
          updated[guid] = text;
          hasChanges = true;
        }
      });
      return hasChanges ? updated : prev;
    });

    if (activeTemplateId) {
      notifyTranslationsAdded(activeTemplateId, Object.keys(newTranslations));
    }
  }, [currentTemplateId]);

  const getTranslation = useCallback((guid: string): string | undefined => {
    const live = translationsLiveRef.current[guid];
    if (live !== undefined) return live;
    return translations[guid];
  }, [translations]);

  const [loadingCompleted, setLoadingCompleted] = useState(false);

  useEffect(() => {
    if (loadingCompleted && !isLoading) {
      setIsReady(true);
      setLoadingCompleted(false);
    }
  }, [loadingCompleted, isLoading]);

  useEffect(() => {
    setProjectTranslationsRegistry(translations);
  }, [translations]);

  /** Keep React translation map + live ref in sync when domain code publishes variable labels (subflow rename). */
  useEffect(() => {
    registerVariableTranslationListener((canonicalKey, text) => {
      translationsLiveRef.current = { ...translationsLiveRef.current, [canonicalKey]: text };
      setProjectTranslationsRegistry(translationsLiveRef.current);
      setTranslations((prev) => {
        if (prev[canonicalKey] === text) return prev;
        return { ...prev, [canonicalKey]: text };
      });
    });
    return () => registerVariableTranslationListener(null);
  }, []);

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
      const invalidKeys = Object.keys(allTranslations).filter((k) => !isValidTranslationStoreKey(k));
      if (invalidKeys.length > 0) {
        console.warn('[ProjectTranslations] Dropping translation rows with non-canonical keys (expected kind:uuid or runtime.*):', {
          count: invalidKeys.length,
          sample: invalidKeys.slice(0, 10),
        });
      }
      const sanitized = Object.fromEntries(
        Object.entries(allTranslations).filter(([k]) => isValidTranslationStoreKey(k))
      );

      snapshotAfterLoadRef.current = { ...sanitized };
      translationsLiveRef.current = sanitized;
      setProjectTranslationsRegistry(sanitized);
      setTranslations(sanitized);

      setLoadingCompleted(true);
    } catch (err) {
      console.error('[ProjectTranslations] ❌ ERROR loadAllTranslations:', err);
      snapshotAfterLoadRef.current = {};
      setLoadingCompleted(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentProjectId, projectLocale]);

  const saveAllTranslations = useCallback(async () => {
    if (!currentProjectId) {
      console.warn('[ProjectTranslations] No project ID, cannot save');
      return;
    }

    const FLOW_KEYS = collectFlowTaskTranslationKeys();
    const snap = snapshotAfterLoadRef.current;
    const base: Record<string, string> = { ...translationsLiveRef.current };
    for (const key of FLOW_KEYS) {
      if (!(key in base)) {
        base[key] = snap[key] ?? '';
      }
    }

    translationsLiveRef.current = base;
    setProjectTranslationsRegistry(base);
    setTranslations(base);

    const projectTranslationsToSave: Array<{ guid: string; language: string; text: string; type?: string }> = [];
    const factoryTranslationsToSave: Array<{ guid: string; language: string; text: string; type?: string }> = [];

    const flowOnlyKeys = collectFlowLocalTranslationKeysFromWorkspace();

    for (const [guid, text] of Object.entries(base)) {
      if (flowOnlyKeys.has(guid)) {
        continue;
      }
      const dest = classifyTranslationKeyDestination(guid);
      const row = {
        guid,
        language: projectLocale,
        text: String(text ?? ''),
        type: 'Instance' as const,
      };
      if (dest === 'factory') {
        factoryTranslationsToSave.push(row);
      } else {
        projectTranslationsToSave.push(row);
      }
    }

    await saveAllTranslationsBulk(currentProjectId, projectTranslationsToSave, factoryTranslationsToSave);
  }, [currentProjectId, projectLocale]);

  const prevProjectIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (currentProjectId) {
      const projectChanged = prevProjectIdRef.current !== currentProjectId;

      if (projectChanged) {
        prevProjectIdRef.current = currentProjectId;
        snapshotAfterLoadRef.current = {};
        setTranslations({});
        translationsLiveRef.current = {};
        setProjectTranslationsRegistry({});
        setIsReady(false);
        loadAllTranslations();
      } else if (Object.keys(translations).length === 0 && !isLoading && !isReady) {
        loadAllTranslations();
      }
    } else {
      prevProjectIdRef.current = null;
      snapshotAfterLoadRef.current = {};
      setIsReady(false);
    }
  }, [currentProjectId, translations, isLoading, isReady, loadAllTranslations]);

  const value: ProjectTranslationsContextType = useMemo(() => ({
    translations,
    addTranslation,
    addTranslations,
    getTranslation,
    loadAllTranslations,
    saveAllTranslations,
    isDirty: false,
    isLoading,
    isReady,
    setCurrentTemplateId
  }), [translations, addTranslation, addTranslations, getTranslation, loadAllTranslations, saveAllTranslations, isLoading, isReady, setCurrentTemplateId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      Object.defineProperty((window as any), '__projectTranslationsContext', {
        value: {
          saveAllTranslations: async () => {
            await saveAllTranslations();
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
            return false;
          },
          get translationsCount() {
            return Object.keys(translations).length;
          },
          get translations() {
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
  }, [saveAllTranslations, addTranslations, addTranslation, loadAllTranslations, translations, setCurrentTemplateId]);

  return (
    <ProjectTranslationsContext.Provider value={value}>
      {children}
    </ProjectTranslationsContext.Provider>
  );
};
