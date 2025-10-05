import React, { useState, useEffect, useRef } from 'react';
import SidebarContainer from './SidebarContainer';
import SidebarHeader from './SidebarHeader';
import EntityAccordion from './EntityAccordion';
import { useSidebarState } from './SidebarState';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { saveDataDialogueTranslations } from '../../services/ProjectDataService';
import { EntityType } from '../../types/project';
import { sidebarTheme } from './sidebarTheme';
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';
import { usePanelZoom } from '../../hooks/usePanelZoom';
import { classifyActInteractivity } from '../../nlp/actInteractivity';

const ICON_MAP: Record<string, React.ReactNode> = {
  bot: <Bot className="w-5 h-5" />,
  user: <User className="w-5 h-5" />,
  database: <Database className="w-5 h-5" />,
  gitBranch: <GitBranch className="w-5 h-5" />,
  checkSquare: <CheckSquare className="w-5 h-5" />,
  layers: <Layers className="w-5 h-5" />,
};

const entityTypes: EntityType[] = [
  'agentActs',
  'userActs',
  'backendActions',
  'conditions',
  'tasks',
  'macrotasks'
];

const Sidebar: React.FC = () => {
  const { openAccordion, setOpenAccordion } = useSidebarState();
  const { data } = useProjectData();
  const {
    addCategory,
    deleteCategory,
    updateCategory,
    addItem,
    deleteItem,
    updateItem
  } = useProjectDataUpdate();

  // Usa il nuovo hook per DDT
  const { ddtList, openDDT, loadDDTError, selectedDDT } = useDDTManager();
  const [search, setSearch] = useState('');

  const [isSavingDDT, setIsSavingDDT] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Handler implementati usando il hook
  // Legacy DDT add flow no longer used (embedded now)

  // When inline builder completes under an Agent Act, embed DDT into the act item and persist later
  const handleCreateEmbeddedDDT = async (categoryId: string, itemId: string, newDDT: any) => {
    // Find the act in local project data and embed
    const category = (data?.agentActs || []).find((c: any) => c.id === categoryId);
    const item = category?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    const version = (item.ddt?.version || 0) + 1;
    const snapshot = {
      version,
      status: 'draft',
      labelKey: newDDT?.label || item.name,
      mains: (newDDT?.mainData || []).map((m: any) => ({
        labelKey: m?.label,
        kind: m?.kind,
        required: (m?.constraints || []).some((c: any) => c?.kind === 'required'),
        constraints: m?.constraints || [],
        messages: m?.messages || {},
        steps: m?.steps || {},
        subs: (m?.subData || []).map((s: any) => ({
          labelKey: s?.label,
          kind: s?.kind,
          required: (s?.constraints || []).some((c: any) => c?.kind === 'required'),
          constraints: s?.constraints || [],
          messages: s?.messages || {},
          steps: s?.steps || {},
        })),
      })),
      translations: (newDDT?.translations && newDDT.translations.en) ? { en: newDDT.translations.en } : undefined,
      builtAt: new Date().toISOString(),
      checksum: (() => { try { return String(btoa(unescape(encodeURIComponent(JSON.stringify(newDDT.mainData||[]))))).slice(0,32); } catch { return String(version); } })(),
      origin: { tool: 'wizard' }
    } as any;
    item.ddt = snapshot;
    try { console.log('[AgentAct][embed.ddt]', { act: item.name, version }); } catch {}
    // Persist via regular updateItem flow (will call Factory PUT best-effort)
    try {
      await updateItem('agentActs', categoryId, itemId, { ddt: snapshot } as any);
    } catch (e) { console.warn('[Sidebar] persist embedded ddt failed', e); }

    // Immediately open Response Editor from the freshly embedded snapshot
    try {
      const transient = {
        id: `runtime.${item.id || item._id}.v${snapshot.version}`,
        label: snapshot.labelKey || item.name,
        mainData: (snapshot.mains || []).map((m: any) => ({
          id: `${Math.random()}`,
          label: m.labelKey,
          type: m.kind,
          subData: (m.subs || []).map((s: any) => ({ id: `${Math.random()}`, label: s.labelKey, type: s.kind, constraints: s.constraints || [], messages: s.messages || {}, steps: s.steps || {} })),
          constraints: m.constraints || [],
          messages: m.messages || {},
          steps: m.steps || {},
        })),
        translations: snapshot.translations || { en: {} }
      } as any;
      openDDT(transient);
    } catch (e) { console.error('[Sidebar] auto-open embedded DDT failed', e); }
  };

  // Open Response Editor from embedded DDT snapshot on the act
  const handleOpenEmbedded = (_categoryId: string, item: any) => {
    const ddtSnap = item?.ddt;
    if (!ddtSnap) return;
    const transient = {
      id: `runtime.${item.id || item._id}.v${ddtSnap.version}`,
      label: ddtSnap.labelKey || item.name,
      mainData: (ddtSnap.mains || []).map((m: any) => ({
        id: `${Math.random()}`,
        label: m.labelKey,
        type: m.kind,
        subData: (m.subs || []).map((s: any) => ({ id: `${Math.random()}`, label: s.labelKey, type: s.kind, constraints: s.constraints || [], messages: s.messages || {}, steps: s.steps || {} })),
        constraints: m.constraints || [],
        messages: m.messages || {},
        steps: m.steps || {},
      })),
      translations: ddtSnap.translations || { en: {} }
    } as any;
    try { openDDT(transient); } catch (e) { console.error('[Sidebar] open embedded DDT failed', e); }
  };

  // const handleEditDDT = (_id: string) => {};

  // const handleDeleteDDT = (id: string) => {};

  // const handleOpenEditor = (id: string) => {};

  // Build from Agent Act helper: prefill wizard with the act label as description
  const handleBuildFromItem = (item: any) => {
    // Show DDT builder inline with initial DDT containing the label in root
    try {
      console.log('[DDT][BuildFromAct][emit]', {
        label: item?.name || item?.label,
        startOnStructure: false
      });
      // Open below DDT header (same behavior of '+')
      const event: any = new CustomEvent('ddt:openBuilderBelowHeader', {
        detail: {
          initialDDT: { label: item?.name || item?.label || 'Data', mainData: [] },
          startOnStructure: false,
          prefillUserDesc: String(item?.name || item?.label || ''),
        },
        bubbles: true,
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('[Sidebar] build-from-item error', e);
    }
  };

  const hasDDTFor = (label: string) => {
    const norm = (s: string) => (s || '').toLowerCase().trim();
    return ddtList.some(dt => norm(dt?.label) === norm(label));
  };

  const handleSaveDDT = async () => {
    setIsSavingDDT(true);
    setSaveError(null);
    try {
      const startedAt = Date.now();
      // 1) Save DataDialogueTranslations (merge existing dynamic translations with current DDT texts)
      const mergedFromDDTs: Record<string, string> = (ddtList || []).reduce((acc: Record<string, string>, ddt: any) => {
        const tr = (ddt?.translations && (ddt.translations.en || ddt.translations)) || {};
        return { ...acc, ...tr };
      }, {});
      const translationsPayload = { ...mergedFromDDTs };
      try {
        await saveDataDialogueTranslations(translationsPayload);
      } catch (e) {
        console.warn('[Sidebar] DataDialogueTranslations save failed, continuing with DDT save:', e);
      }

      // 2) Save DDTs (strip heavy fields not needed by factory DB)
      const payload = (ddtList || []).map((d: any) => {
        const { translations, ...rest } = d || {};
        return rest; // translations are saved separately
      });
      try {
        const approxSize = new Blob([JSON.stringify(payload)]).size;
        console.log('[Sidebar] DDT save payload size ~', approxSize, 'bytes');
      } catch {}
      const res = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Server error: unable to save DDT');
      }
      try { console.log('[KindPersist][Sidebar][saved payload mains]', payload.flatMap((d: any) => (d?.mainData || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })))); } catch {}
      // Nota: non ricarichiamo da backend per evitare flicker; la lista è già la sorgente del payload
      // ensure spinner is visible at least 600ms
      const elapsed = Date.now() - startedAt;
      if (elapsed < 600) {
        await new Promise(r => setTimeout(r, 600 - elapsed));
      }
      // TODO: Mostrare feedback di successo (toast/snackbar)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel salvataggio DDT';
      setSaveError(errorMessage);
      console.error('[Sidebar] Errore salvataggio DDT:', err);
      // TODO: Mostrare toast/alert con l'errore
    } finally {
      setIsSavingDDT(false);
    }
  };

  // Mostra errori di salvataggio
  useEffect(() => {
    if (saveError) {
      console.error('[Sidebar] Errore salvataggio DDT:', saveError);
      // TODO: Mostrare toast/alert con l'errore
    }
  }, [saveError]);

  // Mostra errori di caricamento
  useEffect(() => {
    if (loadDDTError) {
      console.error('[Sidebar] Errore caricamento DDT:', loadDDTError);
      // TODO: Mostrare toast/alert con l'errore
    }
  }, [loadDDTError]);

  // Listener per aprire accordion e evidenziare elementi
  useEffect(() => {
    const handleOpenAccordion = (e: any) => {
      const entityType = e?.detail?.entityType;
      if (entityType && entityTypes.includes(entityType)) {
        setOpenAccordion(entityType);
      }
    };

    const handleHighlightItem = (e: any) => {
      const { entityType, itemName } = e?.detail || {};
      if (entityType && itemName) {
        // Trova la categoria e imposta lastAddedName per evidenziare
        const category = (data as any)?.[entityType]?.[0];
        if (category) {
          // Emetti evento per evidenziare l'elemento nella categoria
          const highlightEvent = new CustomEvent('sidebar:setLastAddedName', {
            detail: { categoryId: category.id, itemName },
            bubbles: true
          });
          document.dispatchEvent(highlightEvent);
        }
      }
    };

    document.addEventListener('sidebar:openAccordion', handleOpenAccordion);
    document.addEventListener('sidebar:highlightItem', handleHighlightItem);

    return () => {
      document.removeEventListener('sidebar:openAccordion', handleOpenAccordion);
      document.removeEventListener('sidebar:highlightItem', handleHighlightItem);
    };
  }, [data, setOpenAccordion]);

  if (!data) return null;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { ref: zoomRef, zoomStyle } = usePanelZoom<HTMLDivElement>(scrollRef);

  // Filter helper: applies to all entity types; keeps category if any item or category matches
  const filterCategories = React.useCallback((cats: any[], q: string) => {
    if (!q) return cats;
    const term = q.toLowerCase();
    return (cats || []).map((cat: any) => {
      const nameMatch = String(cat?.name || '').toLowerCase().includes(term);
      const items = (cat?.items || []).filter((it: any) => String(it?.name || '').toLowerCase().includes(term));
      if (nameMatch && items.length === 0) {
        // if only category matches, keep original items
        return { ...cat };
      }
      return { ...cat, items };
    }).filter((c: any) => (c?.items || []).length > 0 || String(c?.name || '').toLowerCase().includes(term));
  }, []);

  const filteredData: any = React.useMemo(() => {
    if (!data) return data;
    if (!search.trim()) return data;
    const next: any = { ...data };
    for (const t of entityTypes) {
      next[t] = filterCategories((data as any)[t] || [], search);
    }
    return next;
  }, [data, search, filterCategories]);

  return (
    <SidebarContainer>
      <SidebarHeader />
      {/* Search bar */}
      <div className="px-4 py-2 border-b" style={{ background: 'var(--sidebar-content-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca acts o backend calls..."
          style={{ width: '100%', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', background: 'transparent', color: 'var(--sidebar-content-text)' }}
        />
      </div>
      <div
        ref={zoomRef as any}
        className="p-4 overflow-y-auto"
        style={{ flex: 1, ...zoomStyle }}
      >
        {/* DDTSection removed per new embedded flow */}
        {entityTypes.map(type => (
          <EntityAccordion
            key={type}
            entityKey={type}
            title={type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            icon={ICON_MAP[sidebarTheme[type].icon]}
            data={(filteredData as any)[type] || []}
            isOpen={openAccordion === type}
            onToggle={() => setOpenAccordion(openAccordion === type ? '' : type)}
            onAddCategory={name => addCategory(type, name)}
            onDeleteCategory={categoryId => deleteCategory(type, categoryId)}
            onUpdateCategory={(categoryId, updates) => updateCategory(type, categoryId, updates)}
            onAddItem={async (categoryId, name, desc) => {
              await addItem(type, categoryId, name, desc);
              if (type === 'agentActs') {
                try {
                  const inferred = classifyActInteractivity(name);
                  if (typeof inferred === 'boolean') {
                    // find last item just added and update mode
                    const cat = (data?.agentActs || []).find((c: any) => c.id === categoryId);
                    const last = cat?.items?.find((i: any) => (i?.name || '') === name);
                    if (last) {
                      const mode = inferred ? 'DataRequest' : 'Message';
                      await updateItem('agentActs', categoryId, last.id, { mode } as any);
                    }
                  }
                } catch {}
              }
            }}
            onDeleteItem={(categoryId, itemId) => deleteItem(type, categoryId, itemId)}
            onUpdateItem={(categoryId, itemId, updates) => updateItem(type, categoryId, itemId, updates)}
            onBuildFromItem={type === 'agentActs' ? handleBuildFromItem : undefined}
            hasDDTFor={type === 'agentActs' ? hasDDTFor : undefined}
            onCreateDDT={type === 'agentActs' ? handleCreateEmbeddedDDT : undefined}
            onOpenEmbedded={type === 'agentActs' ? (categoryId, itemId) => {
              const category = (data?.agentActs || []).find((c: any) => c.id === categoryId);
              const item = category?.items.find((i: any) => i.id === itemId);
              if (item) handleOpenEmbedded(categoryId, item);
            } : undefined}
          />
        ))}
      </div>
      {/* Editor docked gestito da AppContent */}
    </SidebarContainer>
  );
};

export default Sidebar;