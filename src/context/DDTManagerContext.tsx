import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAllDialogueTemplates, getIDETranslations } from '../services/ProjectDataService';

interface TaskTreeManagerContextType {
  taskTreeList: any[];
  selectedTaskTree: any | null;
  isLoadingTaskTree: boolean;
  loadTaskTreeError: string | null;
  ideTranslations: Record<string, string>;
  createTaskTree: (taskTree: any) => void;
  openTaskTree: (taskTree: any) => void;
  closeTaskTree: () => void;
  deleteTaskTree: (id: string) => void;
  loadTaskTree: () => Promise<void>;
  updateTranslation: (key: string, value: string) => void;
  replaceSelectedTaskTree: (next: any) => void;
}

const TaskTreeManagerContext = createContext<TaskTreeManagerContextType | null>(null);

export const useTaskTreeManager = () => {
  const context = useContext(TaskTreeManagerContext);
  if (!context) {
    throw new Error('useTaskTreeManager must be used within a TaskTreeManagerProvider');
  }
  return context;
};

interface TaskTreeManagerProviderProps {
  children: ReactNode;
}

export const TaskTreeManagerProvider: React.FC<TaskTreeManagerProviderProps> = ({ children }) => {
  const [taskTreeList, setTaskTreeList] = useState<any[]>([]);
  const [selectedTaskTree, setSelectedTaskTree] = useState<any | null>(null);
  const [isLoadingTaskTree, setIsLoadingTaskTree] = useState(false);
  const [loadTaskTreeError, setLoadTaskTreeError] = useState<string | null>(null);
  const [ideTranslations, setIdeTranslations] = useState<Record<string, string>>({});

  const createTaskTree = (taskTree: any) => {
    // ensure has id for future lookups
    const withId = taskTree.id ? taskTree : { ...taskTree, id: taskTree._id || `${(taskTree.label || 'TaskTree').replace(/\s+/g, '_')}_${crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}` };
    try { console.log('[KindPersist][TaskTreeManager][createTaskTree]', { label: withId?.label, nodes: (withId?.nodes || withId?.data || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch { }
    setTaskTreeList(prev => [...prev, withId]);
    setSelectedTaskTree(withId);
  };

  const openTaskTree = (taskTree: any) => {
    try { console.log('[KindPersist][TaskTreeManager][openTaskTree]', { label: taskTree?.label, nodes: (taskTree?.nodes || taskTree?.data || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch { }
    // Preserve steps if we already have an enriched copy of the same DDT in memory
    const sameId = (a: any, b: any) => !!a && !!b && ((a.id && b.id && a.id === b.id) || (a._id && b._id && a._id === b._id));
    const byLabel = (arr: any[]) => {
      const m = new Map<string, any>();
      (arr || []).forEach((n) => { if (n?.label) m.set(String(n.label), n); });
      return m;
    };
    const mergeSteps = (base: any, enriched: any) => {
      if (!base) return enriched;
      const next = { ...enriched };
      // Merge top-level steps if missing
      if (!next.steps && base.steps) next.steps = base.steps;
      const baseMains = Array.isArray(base?.data) ? base.data : [];
      const nextMains = Array.isArray(next?.data) ? next.data : [];
      const baseMap = byLabel(baseMains);
      next.data = nextMains.map((n: any) => {
        const prev = baseMap.get(String(n?.label));
        const mergedTop = (!n?.steps && prev?.steps) ? { ...n, steps: prev.steps } : n;
        const subs = Array.isArray(mergedTop?.subData) ? mergedTop.subData : [];
        const prevSubs = Array.isArray(prev?.subData) ? prev.subData : [];
        const prevSubsMap = byLabel(prevSubs);
        const mergedSubs = subs.map((s: any) => {
          const ps = prevSubsMap.get(String(s?.label));
          return (!s?.steps && ps?.steps) ? { ...s, steps: ps.steps } : s;
        });
        return { ...mergedTop, subData: mergedSubs };
      });
      return next;
    };
    setSelectedTaskTree((prev) => {
      const existing = taskTreeList.find((x) => sameId(x, taskTree));
      const merged = existing ? mergeSteps(existing, taskTree) : taskTree;
      // keep list in sync with merged instance
      setTaskTreeList((list) => list.map((x) => (sameId(x, merged) ? merged : x)));
      return merged;
    });
  };

  const closeTaskTree = () => {
    setSelectedTaskTree(null);
  };

  const deleteTaskTree = (id: string) => {
    setTaskTreeList(prev => prev.filter(taskTree => taskTree.id !== id && taskTree._id !== id));
    if (selectedTaskTree && (selectedTaskTree.id === id || selectedTaskTree._id === id)) {
      setSelectedTaskTree(null);
    }
  };

  // Aggiorna una traduzione per il TaskTree selezionato e sincronizza la lista
  const updateTranslation = (key: string, value: string) => {
    setSelectedTaskTree((prev: any) => {
      if (!prev) return prev;
      const prevTrans = (prev.translations && (prev.translations.en || prev.translations)) || {};
      const nextTranslations = {
        ...(prev.translations || {}),
        en: { ...prevTrans, [key]: value }
      };
      const next = { ...prev, translations: nextTranslations };
      setTaskTreeList(list => list.map(d => (d.id === prev.id || d._id === prev._id ? next : d)));
      return next;
    });
  };

  const loadTaskTree = async () => {
    setIsLoadingTaskTree(true);
    setLoadTaskTreeError(null);
    try {
      const [taskTreeTemplates, ide] = await Promise.all([
        getAllDialogueTemplates(),
        getIDETranslations().catch(() => ({}))
      ]);
      setTaskTreeList(taskTreeTemplates);
      setIdeTranslations(ide || {});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel caricamento TaskTree';
      setLoadTaskTreeError(errorMessage);
      console.error('[TaskTreeManagerContext] Errore caricamento TaskTree:', err);
    } finally {
      setIsLoadingTaskTree(false);
    }
  };

  const replaceSelectedTaskTree = (next: any) => {
    if (!next) return;
    try { console.log('[KindPersist][TaskTreeManager][replaceSelectedTaskTree]', { label: next?.label, nodes: (next?.nodes || next?.data || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch { }
    setSelectedTaskTree(next);
    setTaskTreeList(list => list.map(d => (d.id === next.id || d._id === next._id ? next : d)));
  };

  // DEBUG: Track every selectedTaskTree change
  // Track selectedTaskTree changes if needed for analytics

  // Carica i TaskTree all'inizializzazione
  useEffect(() => {
    loadTaskTree();
  }, []);

  const value = {
    taskTreeList,
    selectedTaskTree,
    isLoadingTaskTree,
    loadTaskTreeError,
    ideTranslations,
    createTaskTree,
    openTaskTree,
    closeTaskTree,
    deleteTaskTree,
    loadTaskTree,
    updateTranslation,
    replaceSelectedTaskTree
  };

  return (
    <TaskTreeManagerContext.Provider value={value}>
      {children}
    </TaskTreeManagerContext.Provider>
  );
};