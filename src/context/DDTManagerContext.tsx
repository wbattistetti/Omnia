import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAllDialogueTemplates, getIDETranslations, getDataDialogueTranslations } from '../services/ProjectDataService';

interface DDTManagerContextType {
  ddtList: any[];
  selectedDDT: any | null;
  isLoadingDDT: boolean;
  loadDDTError: string | null;
  ideTranslations: Record<string, string>;
  dataDialogueTranslations: Record<string, string>;
  setDataDialogueTranslations: (t: Record<string, string>) => void;
  createDDT: (ddt: any) => void;
  openDDT: (ddt: any) => void;
  closeDDT: () => void;
  deleteDDT: (id: string) => void;
  loadDDT: () => Promise<void>;
  updateTranslation: (key: string, value: string) => void;
  replaceSelectedDDT: (next: any) => void;
}

const DDTManagerContext = createContext<DDTManagerContextType | null>(null);

export const useDDTManager = () => {
  const context = useContext(DDTManagerContext);
  if (!context) {
    throw new Error('useDDTManager must be used within a DDTManagerProvider');
  }
  return context;
};

interface DDTManagerProviderProps {
  children: ReactNode;
}

export const DDTManagerProvider: React.FC<DDTManagerProviderProps> = ({ children }) => {
  const [ddtList, setDDTList] = useState<any[]>([]);
  const [selectedDDT, setSelectedDDT] = useState<any | null>(null);
  const [isLoadingDDT, setIsLoadingDDT] = useState(false);
  const [loadDDTError, setLoadDDTError] = useState<string | null>(null);
  const [ideTranslations, setIdeTranslations] = useState<Record<string, string>>({});
  const [dataDialogueTranslations, setDataDialogueTranslations] = useState<Record<string, string>>({});

  const createDDT = (ddt: any) => {
    // ensure has id for future lookups
    const withId = ddt.id ? ddt : { ...ddt, id: ddt._id || `${(ddt.label || 'DDT').replace(/\s+/g, '_')}_${crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}` };
    try { console.log('[KindPersist][DDTManager][createDDT]', { label: withId?.label, mains: (withId?.mainData || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch {}
    setDDTList(prev => [...prev, withId]);
    setSelectedDDT(withId);
  };

  const openDDT = (ddt: any) => {
    try { console.log('[KindPersist][DDTManager][openDDT]', { label: ddt?.label, mains: (ddt?.mainData || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch {}
    // Deep diagnostic: summarize incoming DDT to compare first vs second open
    try {
      const summarize = (x: any) => {
        const mains: any[] = Array.isArray(x?.mainData) ? x.mainData : [];
        return mains.map((m: any) => {
          const steps = m?.steps;
          const shape = steps ? (Array.isArray(steps) ? 'array' : 'object') : 'none';
          const stepKeys = shape === 'object' ? Object.keys(steps || {}) : (shape === 'array' ? (steps as any[]).map((g:any)=>g?.type).filter(Boolean) : []);
          const msgKeys = Object.keys(m?.messages || {});
          const subs = Array.isArray(m?.subData) ? m.subData : [];
          const subsSummary = subs.slice(0, 3).map((s: any) => {
            const sSteps = s?.steps;
            const sShape = sSteps ? (Array.isArray(sSteps) ? 'array' : 'object') : 'none';
            const sStepKeys = sShape === 'object' ? Object.keys(sSteps || {}) : (sShape === 'array' ? (sSteps as any[]).map((g:any)=>g?.type).filter(Boolean) : []);
            const sMsgKeys = Object.keys(s?.messages || {});
            return { label: s?.label, shape: sShape, stepCount: sStepKeys.length, msgCount: sMsgKeys.length };
          });
          return { label: m?.label, shape, stepCount: stepKeys.length, msgCount: msgKeys.length, subs: subsSummary };
        });
      };
      console.log('[RE][openDDT.summary]', summarize(ddt));
    } catch {}
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
      const baseMains = Array.isArray(base?.mainData) ? base.mainData : [];
      const nextMains = Array.isArray(next?.mainData) ? next.mainData : [];
      const baseMap = byLabel(baseMains);
      next.mainData = nextMains.map((n: any) => {
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
    setSelectedDDT((prev) => {
      const existing = ddtList.find((x) => sameId(x, ddt));
      const merged = existing ? mergeSteps(existing, ddt) : ddt;
      // keep list in sync with merged instance
      setDDTList((list) => list.map((x) => (sameId(x, merged) ? merged : x)));
      return merged;
    });
  };

  const closeDDT = () => {
    setSelectedDDT(null);
  };

  const deleteDDT = (id: string) => {
    setDDTList(prev => prev.filter(ddt => ddt.id !== id && ddt._id !== id));
    if (selectedDDT && (selectedDDT.id === id || selectedDDT._id === id)) {
      setSelectedDDT(null);
    }
  };

  // Aggiorna una traduzione per il DDT selezionato e sincronizza la lista
  const updateTranslation = (key: string, value: string) => {
    setSelectedDDT((prev: any) => {
      if (!prev) return prev;
      const prevTrans = (prev.translations && (prev.translations.en || prev.translations)) || {};
      const nextTranslations = {
        ...(prev.translations || {}),
        en: { ...prevTrans, [key]: value }
      };
      const next = { ...prev, translations: nextTranslations };
      setDDTList(list => list.map(d => (d.id === prev.id || d._id === prev._id ? next : d)));
      return next;
    });
  };

  const loadDDT = async () => {
    setIsLoadingDDT(true);
    setLoadDDTError(null);
    try {
      const [ddtTemplates, ide, ddtTr] = await Promise.all([
        getAllDialogueTemplates(),
        getIDETranslations().catch(() => ({})),
        getDataDialogueTranslations().catch(() => ({}))
      ]);
      setDDTList(ddtTemplates);
      setIdeTranslations(ide || {});
      setDataDialogueTranslations(ddtTr || {});
      try {
        const ideCount = ide ? Object.keys(ide).length : 0;
        const ddtCount = ddtTr ? Object.keys(ddtTr).length : 0;
        console.log('[DDTManager] Translations loaded:', { ideCount, ddtCount });
      } catch {}
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel caricamento DDT';
      setLoadDDTError(errorMessage);
      console.error('[DDTManagerContext] Errore caricamento DDT:', err);
    } finally {
      setIsLoadingDDT(false);
    }
  };

  const replaceSelectedDDT = (next: any) => {
    if (!next) return;
    try { console.log('[KindPersist][DDTManager][replaceSelectedDDT]', { label: next?.label, mains: (next?.mainData || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) }); } catch {}
    setSelectedDDT(next);
    setDDTList(list => list.map(d => (d.id === next.id || d._id === next._id ? next : d)));
  };

  // Carica i DDT all'inizializzazione
  useEffect(() => {
    loadDDT();
  }, []);

  const value = {
    ddtList,
    selectedDDT,
    isLoadingDDT,
    loadDDTError,
    ideTranslations,
    dataDialogueTranslations,
    setDataDialogueTranslations,
    createDDT,
    openDDT,
    closeDDT,
    deleteDDT,
    loadDDT,
    updateTranslation,
    replaceSelectedDDT
  };

  return (
    <DDTManagerContext.Provider value={value}>
      {children}
    </DDTManagerContext.Provider>
  );
}; 