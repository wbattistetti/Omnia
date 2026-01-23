import React, { useState, useEffect, useRef } from 'react';
import SidebarContainer from './SidebarContainer';
import SidebarHeader from './SidebarHeader';
import EntityAccordion from './EntityAccordion';
import { useSidebarState } from './SidebarState';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { TemplateTranslationsService } from '../../services/TemplateTranslationsService';
import { EntityType } from '../../types/project';
import { sidebarTheme } from './sidebarTheme';
import { Bot, User, Database, GitBranch, CheckSquare, Layers } from 'lucide-react';
import { usePanelZoom } from '../../hooks/usePanelZoom';
import { classifyTaskInteractivity } from '../../nlp/taskInteractivity';
import { useTaskEditor } from '../TaskEditor/EditorHost/TaskEditorContext'; // ✅ RINOMINATO: ActEditor → TaskEditor, useActEditor → useTaskEditor
import { taskToTaskMeta } from '../../utils/taskToTaskMeta';
import { TaskType } from '../../types/taskTypes';
import type { TaskMeta } from '../TaskEditor/EditorHost/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  bot: <Bot className="w-5 h-5" />,
  user: <User className="w-5 h-5" />,
  database: <Database className="w-5 h-5" />,
  gitBranch: <GitBranch className="w-5 h-5" />,
  checkSquare: <CheckSquare className="w-5 h-5" />,
  layers: <Layers className="w-5 h-5" />,
};

// We will render Speech Acts and Backend Calls separately; keep only Conditions and Tasks here
const entityTypes: EntityType[] = [
  'conditions',
  'macrotasks'
];

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { openAccordion, setOpenAccordion } = useSidebarState();
  const [forceTick, setForceTick] = useState(0);
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
  const { ddtList, loadDDTError } = useDDTManager();
  const taskEditorCtx = useTaskEditor(); // ✅ RINOMINATO: actEditorCtx → taskEditorCtx, useActEditor → useTaskEditor
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  const [isSavingDDT, setIsSavingDDT] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Handler implementati usando il hook
  // Legacy DDT add flow no longer used (embedded now)

  // When inline builder completes under an Agent Act, embed DDT into the act item and persist later
  const handleCreateEmbeddedDDT = async (categoryId: string, itemId: string, newDDT: any) => {
    // Find the act in local project data and embed
    const category = (data?.taskTemplates || []).find((c: any) => c.id === categoryId);
    const item = category?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    const version = (item.ddt?.version || 0) + 1;
    const snapshot = {
      version,
      status: 'draft',
      labelKey: newDDT?.label || item.name,
      mains: (newDDT?.data || []).map((m: any) => ({
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
      checksum: (() => { try { return String(btoa(unescape(encodeURIComponent(JSON.stringify(newDDT.data || []))))).slice(0, 32); } catch { return String(version); } })(),
      origin: { tool: 'wizard' }
    } as any;
    item.ddt = snapshot;
    try { console.log('[AgentAct][embed.ddt]', { act: item.name, version }); } catch { }
    // Persist via regular updateItem flow (will call Factory PUT best-effort)
    try {
      await updateItem('taskTemplates', categoryId, itemId, { ddt: snapshot } as any);
    } catch (e) { }

    // Immediately open Response Editor from the freshly embedded snapshot
    try {
      const transient = {
        id: `runtime.${item.id || item._id}.v${snapshot.version}`,
        label: snapshot.labelKey || item.name,
        data: (snapshot.mains || []).map((m: any) => ({
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
      // ✅ Transient DDT object (no type field) → assume DataRequest
      const taskMeta: TaskMeta = {
        id: transient.id,
        type: TaskType.DataRequest, // ✅ Transient DDT objects are always DataRequest
        label: transient.label,
        instanceId: transient.id,
      };
      taskEditorCtx.open(taskMeta);
    } catch (e) { }
  };

  // Open Response Editor from embedded DDT snapshot on the act
  const handleOpenEmbedded = (_categoryId: string, item: any) => {
    const ddtSnap = item?.ddt;
    if (!ddtSnap) return;
    const transient = {
      id: `runtime.${item.id || item._id}.v${ddtSnap.version}`,
      label: ddtSnap.labelKey || item.name,
      data: (ddtSnap.mains || []).map((m: any) => ({
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
    try {
      // ✅ Transient DDT object (no type field) → assume DataRequest
      const taskMeta: TaskMeta = {
        id: transient.id,
        type: TaskType.DataRequest, // ✅ Transient DDT objects are always DataRequest
        label: transient.label,
        instanceId: transient.id,
      };
      taskEditorCtx.open(taskMeta);
    } catch (e) { }
  };

  // const handleEditDDT = (_id: string) => {};

  // const handleDeleteDDT = (id: string) => {};

  // Open Response Editor from DDT id (clicking gear icon in DDT list)
  const handleOpenEditor = (id: string) => {
    try {
      // Find Task from list (ddtList contains full Task objects)
      const task = ddtList.find(dt => dt.id === id || dt._id === id);
      if (!task) {
        console.warn('[Sidebar][handleOpenEditor] Task not found', { id, ddtListLength: ddtList.length });
        return;
      }

      // ✅ Convert Task to TaskMeta using its actual type field
      const taskMeta = taskToTaskMeta(task);
      taskEditorCtx.open(taskMeta);

      // Emit event with DDT data so AppContent can open it as docking tab
      const event = new CustomEvent('taskEditor:open', { // ✅ RINOMINATO: actEditor:open → taskEditor:open
        detail: {
          id: taskMeta.id,
          type: taskMeta.type, // ✅ TaskType enum invece di stringa
          label: taskMeta.label,
          task: task // Pass full Task in event detail
        },
        bubbles: true
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('[Sidebar][handleOpenEditor] Failed to open editor', {
        error: e,
        ddtId: id,
        timestamp: Date.now()
      });
    }
  };

  // Build from Agent Act helper: prefill wizard with the act label as description
  const handleBuildFromItem = (item: any) => {
    // Show DDT builder inline with initial DDT containing the label in root
    try {
      // Open below DDT header (same behavior of '+')
      const event: any = new CustomEvent('ddt:openBuilderBelowHeader', {
        detail: {
          initialDDT: { label: item?.name || item?.label || 'Data', data: [] },
          startOnStructure: false,
          prefillUserDesc: String(item?.name || item?.label || ''),
        },
        bubbles: true,
      });
      document.dispatchEvent(event);
    } catch (e) {
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
      // Save DDTs (strip heavy fields not needed by factory DB)
      const payload = (ddtList || []).map((d: any) => {
        const { translations, ...rest } = d || {};
        return rest; // translations are saved separately
      });
      try {
        const approxSize = new Blob([JSON.stringify(payload)]).size;
      } catch { }
      const res = await fetch('/api/factory/dialogue-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Server error: unable to save DDT');
      }

      // ✅ Aggiorna cache traduzioni label per ogni template salvato
      const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';
      (ddtList || []).forEach((ddt: any) => {
        const templateId = ddt.id || ddt._id?.toString();
        const label = ddt.label;
        if (templateId && label) {
          TemplateTranslationsService.addLabel(templateId, label, projectLang);
        }
      });

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
      // TODO: Mostrare toast/alert con l'errore
    } finally {
      setIsSavingDDT(false);
    }
  };

  // Mostra errori di salvataggio
  useEffect(() => {
    if (saveError) {
      // TODO: Mostrare toast/alert con l'errore
    }
  }, [saveError]);

  // Mostra errori di caricamento
  useEffect(() => {
    if (loadDDTError) {
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

    const handleSidebarRefresh = (_e: any) => {
      try {
        // Forza un leggero refresh locale leggendo dal ProjectDataService
        const ev = new CustomEvent('sidebar:forceRender', { bubbles: true });
        document.dispatchEvent(ev);
      } catch { }
    };

    const handleForceRender = () => {
      setForceTick((t) => t + 1);
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
    document.addEventListener('sidebar:refresh', handleSidebarRefresh);
    document.addEventListener('sidebar:forceRender', handleForceRender);
    document.addEventListener('sidebar:highlightItem', handleHighlightItem);

    return () => {
      document.removeEventListener('sidebar:openAccordion', handleOpenAccordion);
      document.removeEventListener('sidebar:refresh', handleSidebarRefresh);
      document.removeEventListener('sidebar:forceRender', handleForceRender);
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
    const next: any = { ...data };
    // Apply text filter to the panels managed by entityTypes (conditions, tasks)
    if (search.trim()) {
      for (const t of entityTypes) {
        next[t] = filterCategories((data as any)[t] || [], search);
      }
    }
    // Industry 'undefined' => optional empty dictionaries; keep acts by default (industryFilter 'all')
    if (industryFilter === 'undefined') {
      next.taskTemplates = [];
      next.conditions = [];
    }
    return next;
  }, [data, search, filterCategories, industryFilter, forceTick]);

  // Build Speech Acts (agent acts except BackendCall) and Backend Calls (only BackendCall)
  const buildFilteredActs = React.useCallback((actsCats: any[] | undefined, predicate: (it: any) => boolean) => {
    const src = Array.isArray(actsCats) ? actsCats : [];
    const out: any[] = [];
    for (const cat of src) {
      const items = (cat.items || []).filter(predicate);
      if (items.length > 0) {
        out.push({ ...cat, items });
      }
    }
    return out;
  }, []);

  const speechActsCats = React.useMemo(() => {
      const acts = (filteredData as any)?.taskTemplates || [];
    return buildFilteredActs(acts, (it: any) => (it?.type || '') !== 'BackendCall');
  }, [filteredData, buildFilteredActs, forceTick]);

  const backendCallCats = React.useMemo(() => {
      const acts = (filteredData as any)?.taskTemplates || [];
    return buildFilteredActs(acts, (it: any) => (it?.type || '') === 'BackendCall');
  }, [filteredData, buildFilteredActs, forceTick]);

  return (
    <SidebarContainer>
      <SidebarHeader onClose={onClose} />
      {/* Search bar */}
      <div className="px-4 py-2 border-b" style={{ background: 'var(--sidebar-content-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca acts o backend calls..."
          style={{ width: '100%', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', background: 'transparent', color: 'var(--sidebar-content-text)' }}
        />
      </div>
      {/* Industry filter */}
      <div className="px-4 py-2 border-b" style={{ background: 'var(--sidebar-content-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
        <label className="block text-slate-300 mb-1">Industry</label>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
        >
          <option value="all">all</option>
          <option value="undefined">undefined</option>
        </select>
      </div>
      <div
        ref={zoomRef as any}
        className="p-3 overflow-y-auto"
        style={{ flex: 1, ...zoomStyle }}
      >
        {/* Speech Acts (Agent Acts except Backend Call) */}
        <EntityAccordion
          key="speechActs"
          entityKey={'taskTemplates' as any}
          title="Speech Acts"
          icon={ICON_MAP[sidebarTheme['taskTemplates'].icon]}
          data={speechActsCats}
          isOpen={openAccordion === 'speechActs'}
          onToggle={() => setOpenAccordion(openAccordion === 'speechActs' ? '' : 'speechActs')}
          onAddCategory={name => addCategory('taskTemplates', name)}
          onDeleteCategory={categoryId => deleteCategory('taskTemplates', categoryId)}
          onUpdateCategory={(categoryId, updates) => updateCategory('taskTemplates', categoryId, updates)}
          onAddItem={async (categoryId, name, desc) => {
            await addItem('taskTemplates', categoryId, name, desc);
          }}
          onDeleteItem={(categoryId, itemId) => deleteItem('taskTemplates', categoryId, itemId)}
          onUpdateItem={(categoryId, itemId, updates) => updateItem('taskTemplates', categoryId, itemId, updates)}
          onBuildFromItem={handleBuildFromItem}
          hasDDTFor={hasDDTFor}
          onCreateDDT={handleCreateEmbeddedDDT}
          onOpenEmbedded={(categoryId, itemId) => {
            const category = (data?.taskTemplates || []).find((c: any) => c.id === categoryId);
            const item = category?.items.find((i: any) => i.id === itemId);
            if (item) handleOpenEmbedded(categoryId, item);
          }}
        />

        {/* Backend Calls (Agent Acts of type BackendCall) */}
        <EntityAccordion
          key="backendCalls"
          entityKey={'backendActions' as any}
          title="Backend Calls"
          icon={ICON_MAP[sidebarTheme['backendActions'].icon]}
          data={backendCallCats}
          isOpen={openAccordion === 'backendCalls'}
          onToggle={() => setOpenAccordion(openAccordion === 'backendCalls' ? '' : 'backendCalls')}
          onAddCategory={name => addCategory('taskTemplates', name)}
          onDeleteCategory={categoryId => deleteCategory('taskTemplates', categoryId)}
          onUpdateCategory={(categoryId, updates) => updateCategory('taskTemplates', categoryId, updates)}
          onAddItem={async (categoryId, name, desc) => {
            await addItem('taskTemplates', categoryId, name, desc);
            // Mark as BackendCall if created here (optional - can be set in quick-create flow)
            try {
              const cat = (data?.taskTemplates || []).find((c: any) => c.id === categoryId);
              const last = cat?.items?.find((i: any) => (i?.name || '') === name);
              if (last) {
                await updateItem('taskTemplates', categoryId, last.id, { type: 'BackendCall' } as any);
              }
            } catch { }
          }}
          onDeleteItem={(categoryId, itemId) => deleteItem('taskTemplates', categoryId, itemId)}
          onUpdateItem={(categoryId, itemId, updates) => updateItem('taskTemplates', categoryId, itemId, updates)}
        />

        {/* Conditions and Tasks */}
        {(['conditions', 'macrotasks'] as const).map(type => (
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
            }}
            onDeleteItem={(categoryId, itemId) => deleteItem(type, categoryId, itemId)}
            onUpdateItem={(categoryId, itemId, updates) => updateItem(type, categoryId, itemId, updates)}
          />
        ))}
      </div>
      {/* Editor docked gestito da AppContent */}
    </SidebarContainer>
  );
};

export default Sidebar;