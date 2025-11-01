import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { NewProjectModal } from './NewProjectModal';
import Sidebar from './Sidebar/Sidebar';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from './Flowchart/types/flowTypes';
import { ProjectInfo } from '../types/project';
import { useEffect } from 'react';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
// import ActEditor from './ActEditor';
// import { DockablePanelsHandle } from './DockablePanels';
// import DockablePanels from './DockablePanels';
import { FlowEditor } from './Flowchart/FlowEditor';
import { FlowWorkspace } from './FlowWorkspace/FlowWorkspace';
import { DockWorkspace } from './FlowWorkspace/DockWorkspace';
import { DockManager } from './Dock/DockManager';
import { DockNode, DockTab } from '../dock/types';
import { FlowCanvasHost } from './FlowWorkspace/FlowCanvasHost';
import { FlowWorkspaceProvider } from '../flows/FlowStore.tsx';
import { useFlowActions } from '../flows/FlowStore.tsx';
import { upsertAddNextTo } from '../dock/ops';
import BackendBuilderStudio from '../BackendBuilder/ui/Studio';
import ResizableResponseEditor from './ActEditor/ResponseEditor/ResizableResponseEditor';
import ResizableNonInteractiveEditor from './ActEditor/ResponseEditor/ResizableNonInteractiveEditor';
import ResizableActEditorHost from './ActEditor/EditorHost/ResizableActEditorHost';
import { useActEditor } from './ActEditor/EditorHost/ActEditorContext';
import ConditionEditor from './conditions/ConditionEditor';
import FlowRunner from './debugger/FlowRunner';
import { useDDTContext } from '../context/DDTContext';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from './Sidebar/sidebarTheme';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

interface AppContentProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  currentProject: ProjectData | null;
  setCurrentProject: (project: ProjectData | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  testPanelOpen: boolean;
  setTestPanelOpen: (open: boolean) => void;
  testNodeId: string | null;
  setTestNodeId: (id: string | null) => void;
  onPlayNode: (nodeId: string) => void;
}

export const AppContent: React.FC<AppContentProps> = ({
  appState,
  setAppState,
  currentProject,
  setCurrentProject,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  testPanelOpen,
  setTestPanelOpen,
  testNodeId,
  setTestNodeId,
  onPlayNode
}) => {
  const pdUpdate = useProjectDataUpdate();
  const currentPid = (() => { try { return pdUpdate.getCurrentProjectId(); } catch { return undefined; } })();
  // Dock tree (new dock manager)
  const [dockTree, setDockTree] = useState<DockNode>({ kind: 'tabset', id: 'ts_main', tabs: [{ id: 'tab_main', title: 'Main', flowId: 'main' }], active: 0 });

  // Wrapper che vive sotto il FlowWorkspaceProvider, così può usare useFlowActions
  const FlowTabContent: React.FC<{ tab: DockTab }> = ({ tab }) => {
    const { upsertFlow, openFlowBackground } = useFlowActions();
    return (
      <FlowCanvasHost
        projectId={currentPid as string}
        flowId={tab.flowId}
        onCreateTaskFlow={(newFlowId, title, nodes, edges) => {
          // 1) upsert nel workspace per avere contenuto immediato
          upsertFlow({ id: newFlowId, title: title || newFlowId, nodes, edges });
          openFlowBackground(newFlowId);
          // 2) aggiungi tab accanto a quella corrente nel dock tree
          setDockTree(prev => upsertAddNextTo(prev, tab.id, { id: `tab_${newFlowId}`, title: title || 'Task', flowId: newFlowId }));
        }}
        onOpenTaskFlow={(taskFlowId, title) => {
          // Apri la tab del task accanto a quella corrente (senza duplicati)
          setDockTree(prev => upsertAddNextTo(prev, tab.id, { id: `tab_${taskFlowId}`, title: title || 'Task', flowId: taskFlowId }));
          openFlowBackground(taskFlowId);
        }}
      />
    );
  };
  // Safe access: avoid calling context hook if provider not mounted (e.g., during hot reload glitches)
  let refreshData: () => Promise<void> = async () => { };
  try {
    const ctx = useProjectDataUpdate();
    refreshData = ctx.refreshData;
  } catch (e) {
    // Provider not available yet; use no-op and rely on provider after mount
    refreshData = async () => { };
  }
  // Access full project data for static variables extraction
  let projectData: any = null;
  try {
    projectData = useProjectData().data;
  } catch { }
  const ddtContext = useDDTContext();
  const getTranslationsForDDT = ddtContext.getTranslationsForDDT;
  // const setTranslationsForDDT = ddtContext.setTranslationsForDDT;

  // Usa ActEditor context invece di selectedDDT per unificare l'apertura editor
  const actEditorCtx = useActEditor();
  const [nonInteractiveEditor, setNonInteractiveEditor] = useState<null | { title?: string; value: { template: string; vars?: string[]; samples?: Record<string, string> }; accentColor?: string }>(null);
  const [niSource, setNiSource] = useState<null | { instanceId?: string }>(null);

  // Listen to open event for non-interactive acts (open bottom panel like ResponseEditor)
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      setNonInteractiveEditor({ title: d.title || 'Agent message', value: { template: d.template || '', samples: {}, vars: [] } as any, accentColor: d.accentColor });
      setNiSource({ instanceId: d.instanceId });
    };
    document.addEventListener('nonInteractiveEditor:open', handler as any);
    return () => document.removeEventListener('nonInteractiveEditor:open', handler as any);
  }, []);

  // Listen for ActEditor open events (route envelope to the right editor)
  React.useEffect(() => {
    const h = (e: any) => {
      try {
        const d = (e && e.detail) || {};
        const { open } = (require('./ActEditor/EditorHost/ActEditorContext') as any);
      } catch { }
    };
    // We use context in overlay; simply set a flag by dispatching through context in NodeRow
    return () => { };
  }, []);

  // Stato globale per nodi e edge
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<EdgeData>[]>([]);
  // Stato per feedback salvataggio
  // const [isSaving, setIsSaving] = useState(false);
  // const [saveSuccess, setSaveSuccess] = useState(false);
  // const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showBackendBuilder, setShowBackendBuilder] = useState(false);
  const [showGlobalDebugger, setShowGlobalDebugger] = useState(false);
  const [conditionEditorOpen, setConditionEditorOpen] = useState(false);
  const [conditionVars, setConditionVars] = useState<Record<string, any>>({});
  const [conditionScript, setConditionScript] = useState<string>('');
  const [conditionVarsTree, setConditionVarsTree] = useState<any[]>([]);
  const [conditionLabel, setConditionLabel] = useState<string>('Condition');

  // Listen to Sidebar wrench
  React.useEffect(() => {
    const handler = () => setShowBackendBuilder(true);
    document.addEventListener('backendBuilder:open', handler);
    return () => document.removeEventListener('backendBuilder:open', handler);
  }, []);

  // Open ConditionEditor
  React.useEffect(() => {
    // Helper: build static variables from all Agent Acts' DDT structure
    const buildStaticVars = (): Record<string, any> => {
      const vars: Record<string, any> = {};
      const data = projectData as any;
      try {
        const categories: any[] = (data?.agentActs || []) as any[];
        for (const cat of categories) {
          const items: any[] = (cat?.items || []) as any[];
          for (const it of items) {
            const actName: string = String(it?.name || it?.label || '').trim();
            if (!actName) continue;
            const ddt: any = it?.ddt;
            if (!ddt) continue;
            // Support assembled shape (mainData) and snapshot shape (mains)
            const mains: any[] = Array.isArray(ddt?.mainData)
              ? ddt.mainData
              : (ddt?.mainData ? [ddt.mainData] : (Array.isArray(ddt?.mains) ? ddt.mains : []));
            for (const m of (mains || [])) {
              const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
              const mainKey = `${actName}.${mainLabel}`;
              vars[mainKey] = vars[mainKey] ?? '';
              const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
              for (const s of (subsArr || [])) {
                const subLabel: string = String(s?.labelKey || s?.label || s?.name || 'Field').trim();
                const subKey = `${actName}.${mainLabel}.${subLabel}`;
                vars[subKey] = vars[subKey] ?? '';
              }
            }
          }
        }
      } catch { }
      return vars;
    };

    // Helper: build a hierarchical tree with icons/colors for Intellisense
    const buildVarsTree = (): any[] => {
      const acts: any[] = [];
      const data = projectData as any;
      try {
        const categories: any[] = (data?.agentActs || []) as any[];
        const actColor = (SIDEBAR_TYPE_COLORS as any)?.agentActs?.color || '#34d399';
        const iconKey = (SIDEBAR_TYPE_ICONS as any)?.agentActs;
        const Icon = (SIDEBAR_ICON_COMPONENTS as any)?.[iconKey];
        for (const cat of categories) {
          const items: any[] = (cat?.items || []) as any[];
          for (const it of items) {
            const actName: string = String(it?.name || it?.label || '').trim();
            if (!actName) continue;
            const ddt: any = it?.ddt;
            if (!ddt) continue;
            const mains: any[] = Array.isArray(ddt?.mainData)
              ? ddt.mainData
              : (ddt?.mainData ? [ddt.mainData] : (Array.isArray(ddt?.mains) ? ddt.mains : []));
            const mainsOut: any[] = [];
            for (const m of (mains || [])) {
              const mainLabel: string = String(m?.labelKey || m?.label || m?.name || 'Data').trim();
              const subsArr: any[] = Array.isArray(m?.subData) ? m.subData : (Array.isArray(m?.subs) ? m.subs : []);
              const subsOut = (subsArr || []).map((s: any) => ({ label: String(s?.labelKey || s?.label || s?.name || 'Field').trim(), kind: String(s?.kind || s?.type || '') }));
              mainsOut.push({ label: mainLabel, kind: String(m?.kind || m?.type || ''), subs: subsOut });
            }
            acts.push({ label: actName, color: actColor, Icon, mains: mainsOut });
          }
        }
      } catch { }
      return acts;
    };

    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      const provided = d.variables || {};
      const hasProvided = provided && Object.keys(provided).length > 0;
      const staticVars = buildStaticVars();
      const varsTree = buildVarsTree();
      const finalVars = hasProvided ? provided : staticVars;
      setConditionVars(finalVars);
      setConditionVarsTree((d as any).variablesTree || varsTree);
      setConditionScript(d.script || '');
      setConditionLabel(d.label || d.name || 'Condition');
      setConditionEditorOpen(true);
    };
    document.addEventListener('conditionEditor:open', handler as any);
    return () => document.removeEventListener('conditionEditor:open', handler as any);
  }, [projectData]);

  // Stato per gestione progetti
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per finestre editor DDT aperte (ora con react-mosaic)
  // const [mosaicNodes, setMosaicNodes] = useState<any>(null);
  // const dockablePanelsRef = React.useRef<DockablePanelsHandle>(null);

  // Rimuovi questi stati che ora sono nel hook
  // const [selectedDDT, setSelectedDDT] = useState<any | null>(null);
  // const [selectedDDTLanguage, setSelectedDDTLanguage] = useState<string>('it');
  // const [openedDDTId, setOpenedDDTId] = useState<string>('');
  // const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);

  // Rimuovi questi handler che ora sono nel hook
  // const handleOpenDDTEditor = useCallback(...);
  // const handleCloseDDTEditor = useCallback(...);
  // const handleDeleteDDT = useCallback(...);

  // Pannello di test in alto a sinistra all'avvio
  // React.useEffect(() => {
  //   if (dockablePanelsRef.current) {
  //     dockablePanelsRef.current.openPanel({
  //       id: 'test-panel',
  //       title: 'Test Panel',
  //       ddt: { label: 'Test Panel' },
  //       translations: {},
  //       lang: 'it'
  //     });
  //   }
  // }, []);

  // Carica progetti recenti (ultimi 10)
  const fetchRecentProjects = React.useCallback(async () => {
    try {
      setRecentProjects(await ProjectService.getRecentProjects());
    } catch (e) {
      setRecentProjects([]);
    }
  }, []);
  // Carica tutti i progetti
  const fetchAllProjects = React.useCallback(async () => {
    try {
      setAllProjects(await ProjectService.getAllProjects());
    } catch (e) {
      setAllProjects([]);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    await ProjectService.deleteProject(id);
    setToast('Progetto eliminato!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  }, [fetchRecentProjects, fetchAllProjects]);

  const handleDeleteAllProjects = useCallback(async () => {
    await ProjectService.deleteAllProjects();
    setToast('Tutti i progetti eliminati!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  }, [fetchRecentProjects, fetchAllProjects]);

  // Callback per LandingPage
  const handleLandingNewProject = useCallback(() => setAppState('creatingProject'), [setAppState]);
  // const handleLandingLoadProject = useCallback(async () => { await fetchRecentProjects(); }, [fetchRecentProjects]);
  // const handleLandingShowAllProjects = useCallback(async () => { await fetchAllProjects(); setShowAllProjectsModal(true); }, [fetchAllProjects]);

  // const handleOpenNewProjectModal = useCallback(() => setAppState('creatingProject'), [setAppState]);

  const handleCreateProject = useCallback(async (projectInfo: ProjectInfo): Promise<boolean> => {
    setCreateError(null);
    setIsCreatingProject(true);
    try {
      // DRAFT MODE: nessun bootstrap al server; set flag e temp id
      const tempId = (crypto?.randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2));
      pdUpdate.setDraft(true);
      pdUpdate.setTempId(tempId);
      try { localStorage.setItem('current.projectId', tempId); } catch { }
      const boot = { projectId: tempId } as any;

      // Carica atti direttamente dalla Factory (mode deterministico) rispettando industry
      console.log('[AppContent] Loading acts from factory...');

      try {
        await ProjectDataService.loadActsFromFactory(projectInfo.industry);
        console.log('[AppContent] Factory acts loaded successfully');
      } catch (error) {
        console.error('[AppContent] Error loading factory acts:', error);
      }

      const data = await ProjectDataService.loadProjectData();

      // 3) Inizializza stato UI
      const newProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        id: boot.projectId,
        industry: projectInfo.industry || 'defaultIndustry',
        agentActs: data.agentActs,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: data.tasks,
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { localStorage.setItem('project.lang', String(projectInfo.language || 'pt')); } catch { }
      try { pdUpdate.setCurrentProjectId(boot.projectId); console.log('[Bootstrap][projectId][DRAFT]', boot.projectId); } catch { }
      setNodes([]);
      setEdges([]);
      await refreshData();
      setAppState('mainApp');
      return true;
    } catch (e) {
      setCreateError('Errore nella creazione del progetto');
      return false;
    } finally {
      setIsCreatingProject(false);
    }
  }, [refreshData, setAppState]);

  const handleCloseNewProjectModal = useCallback(() => setAppState('landing'), [setAppState]);

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    try {
      // Modalità persisted: apri da catalogo e carica acts dal DB progetto
      const catRes = await fetch('/api/projects/catalog');
      if (!catRes.ok) throw new Error('Errore nel recupero catalogo');
      const list = await catRes.json();
      const meta = (list || []).find((x: any) => x._id === id || x.projectId === id) || {};
      pdUpdate.setDraft(false);
      pdUpdate.setCurrentProjectId(id);
      try { localStorage.setItem('current.projectId', id); } catch { }
      // Carica atti dal DB progetto
      await ProjectDataService.loadActsFromProject(id);
      // Carica istanze dal DB progetto
      try {
        const { instanceRepository } = await import('../services/InstanceRepository');
        await instanceRepository.loadInstancesFromDatabase(id);
      } catch (e) {
        console.warn('[OpenProject] Failed to load instances:', e);
        // Non bloccare l'apertura del progetto se questo fallisce
      }
      // Carica flow (nodi/edge)
      let loadedNodes: any[] = [];
      let loadedEdges: any[] = [];
      try {
        const flowRes = await fetch(`/api/projects/${encodeURIComponent(id)}/flow`);
        if (flowRes.ok) {
          const flow = await flowRes.json();
          loadedNodes = Array.isArray(flow.nodes) ? flow.nodes : [];
          loadedEdges = Array.isArray(flow.edges) ? flow.edges : [];
          // Removed verbose log
        }
      } catch { }
      const data = await ProjectDataService.loadProjectData();
      const newProject: any = {
        id,
        name: meta.projectName || 'Project',
        clientName: meta.clientName || 'Client',
        template: meta.industry || 'utility_gas',
        industry: meta.industry || 'utility_gas',
        agentActs: data.agentActs,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: data.tasks,
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { if (meta && meta.language) localStorage.setItem('project.lang', String(meta.language)); } catch { }
      setNodes(loadedNodes as any);
      setEdges(loadedEdges as any);
      await refreshData();
      setAppState('mainApp');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [refreshData, setAppState]);

  const handleShowRecentProjects = useCallback(async (id?: string) => {
    if (id) {
      await handleOpenProjectById(id);
      setAppState('mainApp');
      return;
    }
    try {
      const response = await fetch('/projects');
      if (!response.ok) throw new Error('Errore nel recupero progetti');
      const projects = await response.json();
      if (!projects.length) {
        alert('Nessun progetto recente trovato.');
        return;
      }
      const choices = projects.map((p: any, i: number) => `${i + 1}. ${p.name || '(senza nome)'} [${p._id}]`).join('\n');
      const idx = prompt(`Progetti recenti:\n${choices}\n\nInserisci il numero del progetto da caricare:`);
      const selected = parseInt(idx || '', 10);
      if (!selected || selected < 1 || selected > projects.length) return;
      const selId = projects[selected - 1]._id;
      await handleOpenProjectById(selId);
      setAppState('mainApp');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [handleOpenProjectById, setAppState]);

  // Passa una funzione a NewProjectModal per azzerare l'errore duplicato quando cambia il nome
  const handleProjectNameChange = useCallback(() => {
    if (createError) setCreateError(null);
  }, [createError]);

  // Carica progetti recenti ogni volta che si entra nella landing
  useEffect(() => {
    if (appState === 'landing') {
      fetchRecentProjects();
    }
  }, [appState, fetchRecentProjects]);

  useEffect(() => {
    if (showAllProjectsModal) {
      fetchAllProjects();
    }
  }, [showAllProjectsModal, fetchAllProjects]);

  return (
    <div className="min-h-screen" style={{ position: 'relative' }}>
      {/* overlay ricarico rimosso per test */}
      {/* Toast feedback */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-700 text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
      {/* Landing Page + New Project Modal */}
      {(appState === 'landing' || appState === 'creatingProject') && (
        <>
          <LandingPage
            onNewProject={handleLandingNewProject}
            recentProjects={recentProjects}
            allProjects={allProjects}
            onDeleteProject={handleDeleteProject}
            onDeleteAllProjects={handleDeleteAllProjects}
            showAllProjectsModal={showAllProjectsModal}
            setShowAllProjectsModal={setShowAllProjectsModal}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectProject={async (id: string) => {
              await handleOpenProjectById(id);
              setAppState('mainApp');
            }}
          />
          <NewProjectModal
            isOpen={appState === 'creatingProject'}
            onClose={handleCloseNewProjectModal}
            onCreateProject={handleCreateProject}
            onLoadProject={handleShowRecentProjects}
            duplicateNameError={createError}
            onProjectNameChange={handleProjectNameChange}
            isLoading={isCreatingProject}
            onFactoryTemplatesLoaded={() => { /* templates loaded; proxied via 8000 now */ }}
          />
        </>
      )}
      {/* Main App: Sidebar + FlowEditor */}
      {appState === 'mainApp' && (
        <div className="min-h-screen flex">
          <SidebarThemeProvider>
            <Sidebar />
          </SidebarThemeProvider>
          <div className="flex-1 flex flex-col">
            <Toolbar
              onNewProject={() => alert('Nuovo progetto')}
              onOpenProject={() => alert('Apri progetto')}
              isSaving={isCreatingProject}
              onSave={async () => {
                try {
                  // show spinner in toolbar while saving
                  setIsCreatingProject(true);
                  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  const dataSvc: any = (ProjectDataService as any);
                  // 1) bootstrap (solo se siamo in draft)
                  let pid = pdUpdate.getCurrentProjectId();
                  if (pdUpdate.isDraft()) {
                    const tb = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const resp = await fetch('/api/projects/bootstrap', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        clientName: (currentProject as any)?.clientName || (currentProject as any)?.name || 'Client',
                        projectName: (currentProject as any)?.name || 'Project',
                        industry: (currentProject as any)?.template || 'utility_gas',
                        tenantId: 'tenant_default'
                      })
                    });
                    if (!resp.ok) throw new Error('bootstrap_failed');
                    const boot = await resp.json();
                    // Aggiorna sia il context che la variabile locale da usare in questo save
                    pdUpdate.setCurrentProjectId(boot.projectId);
                    pid = boot.projectId;
                    try { localStorage.setItem('current.projectId', boot.projectId); } catch { }
                    pdUpdate.setDraft(false);
                    // Nota: non chiamare /api/projects/catalog qui; il bootstrap registra già nel catalogo
                    const te = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    try { console.log('[Save][timing] bootstrap ms', Math.round(te - tb)); } catch { }
                  }
                  // Usa sempre la variabile locale pid (aggiornata sopra se bootstrap)
                  try { console.log('[Save][begin]', { pid, draft: pdUpdate.isDraft() }); } catch { }
                  // 2) persisti tutte le istanze dal draft store (se esistono)
                  const key = pdUpdate.getTempId();
                  const draft = (dataSvc as any).__draftInstances?.get?.(key);
                  if (draft && pid) {
                    const tI0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    const items: any[] = [];
                    for (const [, inst] of draft.entries()) {
                      items.push({ baseActId: inst.baseActId, mode: inst.mode, message: inst.message, overrides: inst.overrides });
                    }
                    if (items.length) {
                      try { console.log('[Save][instances][bulk]', { pid, count: items.length }); } catch { }
                      await (ProjectDataService as any).bulkCreateInstances(pid, items);
                    }
                    (dataSvc as any).__draftInstances.delete(key);
                    const tI1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    try { console.log('[Save][timing] instances ms', Math.round(tI1 - tI0), 'count', items.length); } catch { }
                  }
                  // 2c) Persisti tutte le istanze con DDT da InstanceRepository
                  if (pid) {
                    try {
                      const tI2_0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      const { instanceRepository } = await import('../services/InstanceRepository');
                      const saved = await instanceRepository.saveAllInstancesToDatabase(pid);
                      const tI2_1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      if (saved) {
                        try { console.log('[Save][instances][repository]', { pid, ms: Math.round(tI2_1 - tI2_0) }); } catch { }
                      } else {
                        try { console.warn('[Save][instances][repository]', { pid, ms: Math.round(tI2_1 - tI2_0), warning: 'some_failed' }); } catch { }
                      }
                    } catch (e) {
                      console.error('[Save][instances][repository] error', e);
                      // Non bloccare il salvataggio del progetto se questo fallisce
                    }
                  }
                  // 2b) persisti gli Agent Acts creati al volo nel DB progetto (solo su Save esplicito)
                  try {
                    if (pid && projectData) {
                      try {
                        const flows = (window as any).__flows || {};
                        const main = flows?.main || { nodes, edges };
                        console.log('[Save][precheck]', { pid, mainNodes: main.nodes?.length || 0, mainEdges: main.edges?.length || 0 });
                      } catch { }
                      const tA0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      await (ProjectDataService as any).saveProjectActsToDb?.(pid, projectData);
                      // Reload fresh project data so act.problem is populated from DB
                      try {
                        const fresh = await (ProjectDataService as any).loadProjectData?.();
                        if (fresh) {
                          try { pdUpdate.setData && (pdUpdate as any).setData(fresh); } catch { }
                        }
                      } catch { }
                      const tA1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      try { console.log('[Save][timing] acts ms', Math.round(tA1 - tA0)); } catch { }
                    }
                  } catch { }
                  // 3) salva flusso (nodi/edge) - stato così com'è, senza guard
                  if (pid) {
                    try {
                      const tf0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      try {
                        const flows = (window as any).__flows || {};
                        const main = flows?.main || { nodes, edges };
                        console.log('[Flow][save][begin]', { pid, flowId: 'main', nodes: main.nodes?.length || 0, edges: main.edges?.length || 0 });
                      } catch { }
                      const svc = await import('../services/FlowPersistService');
                      await svc.flushFlowPersist();
                      // Final PUT immediate (explicit Save)
                      const putRes = await fetch(`/api/projects/${encodeURIComponent(pid)}/flow?flowId=main`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(((window as any).__flows && (window as any).__flows.main) ? { nodes: (window as any).__flows.main.nodes, edges: (window as any).__flows.main.edges } : { nodes, edges })
                      });
                      const tf1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                      if (!putRes.ok) {
                        try { console.warn('[Flow][save][error]', { pid, flowId: 'main', ms: Math.round(tf1 - tf0), status: putRes.status, statusText: putRes.statusText, body: await putRes.text() }); } catch { }
                      } else {
                        try { console.log('[Flow][save][ok]', { pid, flowId: 'main', ms: Math.round(tf1 - tf0) }); } catch { }
                      }
                      // Reload automatico e overlay rimossi per test semplificato
                    } catch { }
                  }
                  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  try { console.log('[Save][end]', { totalMs: Math.round(t1 - t0) }); } catch { }
                  // Removed noisy meta POST; language is already stored during bootstrap
                } catch (e) {
                  console.error('[SaveProject] commit error', e);
                } finally {
                  setIsCreatingProject(false);
                }
              }}
              onRun={() => setShowGlobalDebugger(s => !s)}
              onSettings={() => setShowBackendBuilder(true)}
              projectName={currentProject?.name}
            />
            <div id="flow-canvas-host" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: showGlobalDebugger ? '1fr 380px' : '1fr', position: 'relative' }}>
              {showBackendBuilder ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <BackendBuilderStudio onClose={() => setShowBackendBuilder(false)} />
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {currentPid ? (
                    <FlowWorkspaceProvider>
                      <DockManager
                        root={dockTree}
                        setRoot={setDockTree}
                        renderTabContent={(tab) => (<FlowTabContent tab={tab} />)}
                      />
                    </FlowWorkspaceProvider>
                  ) : (
                    <FlowEditor
                      nodes={nodes}
                      setNodes={setNodes}
                      edges={edges}
                      setEdges={setEdges}
                      currentProject={currentProject}
                      setCurrentProject={setCurrentProject}
                      onPlayNode={onPlayNode}
                      testPanelOpen={testPanelOpen}
                      setTestPanelOpen={setTestPanelOpen}
                      testNodeId={testNodeId}
                      setTestNodeId={setTestNodeId}
                    />
                  )}
                  {!showGlobalDebugger && (
                    <ConditionEditor
                      open={conditionEditorOpen}
                      onClose={() => setConditionEditorOpen(false)}
                      variables={conditionVars}
                      initialScript={conditionScript}
                      variablesTree={conditionVarsTree}
                      label={conditionLabel}
                      dockWithinParent={true}
                      onRename={(next) => {
                        setConditionLabel(next);
                        try { (async () => { (await import('../ui/events')).emitConditionEditorRename(next); })(); } catch { }
                      }}
                      onSave={(script) => {
                        try { (async () => { (await import('../ui/events')).emitConditionEditorSave(script); })(); } catch { }
                      }}
                    />
                  )}
                </div>
              )}
              {showGlobalDebugger && (
                <div style={{ position: 'relative' }}>
                  <FlowRunner nodes={nodes} edges={edges} />
                  <ConditionEditor
                    open={conditionEditorOpen}
                    onClose={() => setConditionEditorOpen(false)}
                    variables={conditionVars}
                    initialScript={conditionScript}
                    variablesTree={conditionVarsTree}
                    label={conditionLabel}
                    dockWithinParent={true}
                    onRename={(next) => {
                      setConditionLabel(next);
                      try { (async () => { (await import('../ui/events')).emitConditionEditorRename(next); })(); } catch { }
                    }}
                    onSave={(script) => {
                      try { (async () => { (await import('../ui/events')).emitConditionEditorSave(script); })(); } catch { }
                    }}
                  />
                </div>
              )}
            </div>
            {/* Act Editor Host overlay (always listens via context) */}
            <ActEditorOverlay />

            {nonInteractiveEditor && (
              <ResizableNonInteractiveEditor
                title={nonInteractiveEditor.title}
                value={nonInteractiveEditor.value}
                onChange={(next) => {
                  // Only update local draft; persist on close
                  setNonInteractiveEditor({ title: nonInteractiveEditor.title, value: next, accentColor: (nonInteractiveEditor as any).accentColor });
                }}
                onClose={async () => {
                  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  try {
                    const svc = await import('../services/ProjectDataService');
                    const dataSvc: any = (svc as any).ProjectDataService;
                    const pid = pdUpdate.getCurrentProjectId() || undefined;
                    if (pid && niSource?.instanceId) {
                      // fire-and-forget: non bloccare la chiusura del pannello
                      const text = nonInteractiveEditor?.value?.template || '';
                      void dataSvc.updateInstance(pid, niSource.instanceId, { message: { text } })
                        .then(() => { try { console.log('[NI][close][PUT ok]', { instanceId: niSource?.instanceId }); } catch { } })
                        .catch((e: any) => { try { console.warn('[NI][close][PUT fail]', e); } catch { } });
                      // broadcast per aggiornare la riga che ha questa istanza
                      try { document.dispatchEvent(new CustomEvent('rowMessage:update', { detail: { instanceId: niSource.instanceId, text } })); } catch { }
                    }
                  } catch (e) { try { console.warn('[NI][close] background persist setup failed', e); } catch { } }
                  // chiudi SUBITO il pannello (render immediato)
                  setNonInteractiveEditor(null);
                  setNiSource(null);
                  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  try { console.log('[NI][close] panel closed in', Math.round(t1 - t0), 'ms'); } catch { }
                }}
                accentColor={(nonInteractiveEditor as any).accentColor}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Overlay that renders the ActEditorHost when an act is selected via context
function ActEditorOverlay() {
  const ctx = useActEditor();
  const [hostRect, setHostRect] = React.useState<DOMRect | null>(null);
  // Bridge DOM event → context.open to allow callers to emit without importing the hook
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      if (d && d.id && d.type) ctx.open(d);
    };
    document.addEventListener('actEditor:open', handler as any);
    return () => document.removeEventListener('actEditor:open', handler as any);
  }, [ctx]);
  // Track canvas host bounding box
  React.useEffect(() => {
    const update = () => {
      const el = document.getElementById('flow-canvas-host');
      if (el) {
        const rect = el.getBoundingClientRect();
        setHostRect(rect);
      } else {
        setHostRect(null);
      }
    };
    update();
    window.addEventListener('resize', update);
    const el = document.getElementById('flow-canvas-host');
    let mo: MutationObserver | undefined;
    if (el) {
      mo = new MutationObserver(update);
      mo.observe(el, { attributes: true, childList: true, subtree: true });
    }
    return () => { window.removeEventListener('resize', update); mo?.disconnect(); };
  }, []);

  if (!ctx.act || !hostRect) {
    return null;
  }
  const node = (
    <div
      style={{ position: 'absolute', left: hostRect.left, width: hostRect.width, bottom: 0, zIndex: 50, pointerEvents: 'auto' }}
    >
      <ResizableActEditorHost act={ctx.act} onClose={ctx.close} />
    </div>
  );
  return createPortal(node, document.body);
}