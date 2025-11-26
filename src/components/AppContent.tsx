import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { useFontClasses } from '../hooks/useFontClasses';
import { NewProjectModal } from './NewProjectModal';
import Sidebar from './Sidebar/Sidebar';
import LibraryLabel from './Sidebar/LibraryLabel';
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
import DDEBubbleChat from './ChatSimulator/DDEBubbleChat';
import { useDDTContext } from '../context/DDTContext';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from './Sidebar/sidebarTheme';
// FASE 2: InstanceRepository import removed - using TaskRepository instead
// TaskRepository automatically syncs with InstanceRepository for backward compatibility
import { flowchartVariablesService } from '../services/FlowchartVariablesService';

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
      const instanceId = d.instanceId;

      // Read message text from Task
      let template = '';
      if (instanceId) {
        const { taskRepository } = require('../services/TaskRepository');
        let task = taskRepository.getTask(instanceId);
        // Create Task if it doesn't exist (will be saved when closing)
        if (!task) {
          // Try to get actId from row (passed in event detail) or use 'Message' as default
          const actId = d.actId || d.baseActId || 'Message';
          // Map actId to action (e.g., 'Message' -> 'SayMessage')
          const action = actId === 'Message' ? 'SayMessage' : actId;
          task = taskRepository.createTask(action, undefined, instanceId);
        }
        template = task?.value?.text || '';
      }

      setNonInteractiveEditor({ title: d.title || 'Agent message', value: { template, samples: {}, vars: [] } as any, accentColor: d.accentColor });
      setNiSource({ instanceId });
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

  // Note: nodes/edges are read directly from window.__flowNodes by DDEBubbleChat in flow mode
  // No local state needed to avoid flickering and synchronization issues
  // Stato per feedback salvataggio
  // const [isSaving, setIsSaving] = useState(false);
  // const [saveSuccess, setSaveSuccess] = useState(false);
  // const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showBackendBuilder, setShowBackendBuilder] = useState(false);
  const [showGlobalDebugger, setShowGlobalDebugger] = useState(false);
  const [debuggerWidth, setDebuggerWidth] = useState(380); // Larghezza dinamica invece di fissa
  const [isResizing, setIsResizing] = useState(false);
  const [conditionEditorOpen, setConditionEditorOpen] = useState(false);
  const [conditionVars, setConditionVars] = useState<Record<string, any>>({});
  const [conditionScript, setConditionScript] = useState<string>('');
  const [conditionVarsTree, setConditionVarsTree] = useState<any[]>([]);
  const [conditionLabel, setConditionLabel] = useState<string>('Condition');

  // Handler per il resize del pannello di debug
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const container = document.getElementById('flow-canvas-host');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;

    // Limiti: minimo 200px, massimo 800px
    const clampedWidth = Math.max(200, Math.min(800, newWidth));
    setDebuggerWidth(clampedWidth);
  }, [isResizing]);

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

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

    // ✅ NEW: Build flowchart variables
    const buildFlowchartVars = async (): Promise<Record<string, any>> => {
      const vars: Record<string, any> = {};
      try {
        const projectId = pdUpdate?.getCurrentProjectId();
        if (projectId) {
          await flowchartVariablesService.init(projectId);
          const varNames = flowchartVariablesService.getAllReadableNames();
          varNames.forEach(name => {
            vars[name] = ''; // Empty value, just for autocomplete
          });
        }
      } catch {}
      return vars;
    };

    const handler = async (e: any) => {
      const d = (e && e.detail) || {};
      const provided = d.variables || {};
      const hasProvided = provided && Object.keys(provided).length > 0;
      const staticVars = buildStaticVars();
      const flowchartVars = await buildFlowchartVars(); // ✅ NEW
      const varsTree = buildVarsTree();

      // Merge static vars with flowchart vars
      const allVars = { ...staticVars, ...flowchartVars }; // ✅ NEW

      const finalVars = hasProvided ? provided : allVars;
      setConditionVars(finalVars);
      setConditionVarsTree((d as any).variablesTree || varsTree);
      console.log('[LOAD_SCRIPT] 🔍 From AppContent (event)', {
        conditionName: d.label || d.name || 'Condition',
        scriptLength: d.script?.length || 0
      });
      setConditionScript(d.script || '');
      setConditionLabel(d.label || d.name || 'Condition');

      // Scroll to node using ReactFlow viewport (if nodeId is provided)
      if (d.nodeId) {
        console.log('[AppContent] Emitting scroll to node event', { nodeId: d.nodeId });
        setTimeout(() => {
          try {
            document.dispatchEvent(new CustomEvent('flowchart:scrollToNode', {
              detail: { nodeId: d.nodeId },
              bubbles: true
            }));
            console.log('[AppContent] Scroll event dispatched');
          } catch (err) {
            console.warn('[ConditionEditor] Failed to emit scroll event', err);
          }
        }, 100);
      } else {
        console.log('[AppContent] No nodeId provided, skipping scroll');
      }

      setConditionEditorOpen(true);
    };
    document.addEventListener('conditionEditor:open', handler as any);

    // ✅ NEW: Listen for flowchart variables updates
    const varsUpdateHandler = async () => {
      if (conditionEditorOpen) {
        const flowchartVars = await buildFlowchartVars();
        const staticVars = buildStaticVars();
        setConditionVars({ ...staticVars, ...flowchartVars });
      }
    };
    document.addEventListener('flowchart:variablesUpdated', varsUpdateHandler as any);

    return () => {
      document.removeEventListener('conditionEditor:open', handler as any);
      document.removeEventListener('flowchart:variablesUpdated', varsUpdateHandler as any);
    };
  }, [projectData, pdUpdate, conditionEditorOpen]);

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
      // Bootstrap immediato: crea DB e catalog subito
      const resp = await fetch('/api/projects/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: projectInfo.clientName || null,
          projectName: projectInfo.name || 'Project',
          industry: projectInfo.industry || 'utility_gas',
          language: projectInfo.language || 'pt',
          ownerCompany: projectInfo.ownerCompany || null,
          ownerClient: projectInfo.ownerClient || null,
          version: projectInfo.version || '1.0',
          versionQualifier: projectInfo.versionQualifier || 'alpha',
          tenantId: 'tenant_default'
        })
      });
      if (!resp.ok) throw new Error('bootstrap_failed');
      const boot = await resp.json();
      const projectId = boot.projectId;

      // Carica atti dal progetto appena creato
      try {
        await ProjectDataService.loadActsFromProject(projectId);
      } catch (error) {
      }

      const data = await ProjectDataService.loadProjectData();

      // Inizializza stato UI
      const newProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        id: projectId,
        industry: projectInfo.industry || 'utility_gas',
        ownerCompany: projectInfo.ownerCompany || null,
        ownerClient: projectInfo.ownerClient || null,
        agentActs: data.agentActs,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [], // Deprecated: tasks migrated to macrotasks
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { localStorage.setItem('project.lang', String(projectInfo.language || 'pt')); } catch { }
      try { localStorage.setItem('current.projectId', projectId); } catch { }
      pdUpdate.setCurrentProjectId(projectId);
      try {
        (window as any).__flowNodes = [];
        (window as any).__flowEdges = [];
      } catch { }
      await refreshData();
      setAppState('mainApp');
      return true;
    } catch (e) {
      setCreateError('Errore nella creazione del progetto');
      return false;
    } finally {
      setIsCreatingProject(false);
    }
  }, [refreshData, setAppState, pdUpdate]);

  const handleCloseNewProjectModal = useCallback(() => setAppState('landing'), [setAppState]);

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    const startTime = performance.now();
    console.log(`[PERF][${new Date().toISOString()}] 🚀 START handleOpenProjectById`, { projectId: id });

    try {
      // Modalità persisted: apri da catalogo e carica acts dal DB progetto
      const catStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 📋 START fetch catalog`);
      const catRes = await fetch('/api/projects/catalog');
      if (!catRes.ok) throw new Error('Errore nel recupero catalogo');
      const list = await catRes.json();
      const meta = (list || []).find((x: any) => x._id === id || x.projectId === id) || {};
      console.log(`[PERF][${new Date().toISOString()}] ✅ END fetch catalog`, {
        duration: `${(performance.now() - catStart).toFixed(2)}ms`,
        found: !!meta
      });

      pdUpdate.setCurrentProjectId(id);
      try { localStorage.setItem('current.projectId', id); } catch { }

      // ✅ OPTIMIZATION: Load acts, tasks, flow, and variable mappings in parallel (they are independent)
      const parallelStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 🔄 START parallel load (acts, tasks, flow, mappings)`);

      const [actsResult, tasksResult, flowResult, mappingsResult] = await Promise.allSettled([
        ProjectDataService.loadActsFromProject(id),
        (async () => {
          try {
            const { taskRepository } = await import('../services/TaskRepository');
            return await taskRepository.loadAllTasksFromDatabase(id);
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
              projectId: id,
              error: String(e)
            });
            return false;
          }
        })(),
        (async () => {
          try {
            const flowRes = await fetch(`/api/projects/${encodeURIComponent(id)}/flow`);
            if (flowRes.ok) {
              const flow = await flowRes.json();
              return {
                nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
                edges: Array.isArray(flow.edges) ? flow.edges : []
              };
            }
            return { nodes: [], edges: [] };
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load flow`, e);
            return { nodes: [], edges: [] };
          }
        })(),
        (async () => {
          try {
            const { flowchartVariablesService } = await import('../services/FlowchartVariablesService');
            await flowchartVariablesService.init(id);
            return true;
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load variable mappings`, e);
            return false;
          }
        })()
      ]);

      console.log(`[PERF][${new Date().toISOString()}] ✅ END parallel load`, {
        duration: `${(performance.now() - parallelStart).toFixed(2)}ms`
      });

      // Process results
      if (actsResult.status === 'rejected') {
        throw actsResult.reason;
      }

      let loadedNodes: any[] = [];
      let loadedEdges: any[] = [];
      if (flowResult.status === 'fulfilled') {
        loadedNodes = flowResult.value.nodes;
        loadedEdges = flowResult.value.edges;
        console.log(`[PERF][${new Date().toISOString()}] ✅ Flow loaded`, {
          nodesCount: loadedNodes.length,
          edgesCount: loadedEdges.length
        });
      }

      if (tasksResult.status === 'fulfilled') {
        const { taskRepository } = await import('../services/TaskRepository');
        console.log(`[PERF][${new Date().toISOString()}] ✅ Tasks loaded`, {
          success: tasksResult.value,
          tasksCount: taskRepository.getInternalTasksCount(),
          tasksWithValue: taskRepository.getAllTasks().filter(t => t.value && Object.keys(t.value).length > 0).length
        });
      }

      const dataStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 📊 START loadProjectData`);
      const data = await ProjectDataService.loadProjectData();
      console.log(`[PERF][${new Date().toISOString()}] ✅ END loadProjectData`, {
        duration: `${(performance.now() - dataStart).toFixed(2)}ms`
      });

      const newProject: any = {
        id,
        name: meta.projectName || 'Project',
        clientName: meta.clientName || null,
        template: meta.industry || 'utility_gas',
        industry: meta.industry || 'utility_gas',
        ownerCompany: meta.ownerCompany || null,
        ownerClient: meta.ownerClient || null,
        agentActs: data.agentActs,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [], // Deprecated: tasks migrated to macrotasks
        macrotasks: data.macrotasks
      };
      setCurrentProject(newProject);
      try { if (meta && meta.language) localStorage.setItem('project.lang', String(meta.language)); } catch { }
      try {
        (window as any).__flowNodes = loadedNodes as any;
        (window as any).__flowEdges = loadedEdges as any;
      } catch { }

      const refreshStart = performance.now();
      console.log(`[PERF][${new Date().toISOString()}] 🔄 START refreshData`);
      await refreshData();
      console.log(`[PERF][${new Date().toISOString()}] ✅ END refreshData`, {
        duration: `${(performance.now() - refreshStart).toFixed(2)}ms`
      });

      setAppState('mainApp');

      const totalDuration = performance.now() - startTime;
      console.log(`[PERF][${new Date().toISOString()}] 🎉 COMPLETE handleOpenProjectById`, {
        projectId: id,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        totalDurationSeconds: `${(totalDuration / 1000).toFixed(2)}s`
      });
    } catch (err) {
      const totalDuration = performance.now() - startTime;
      console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR handleOpenProjectById`, {
        projectId: id,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        error: err instanceof Error ? err.message : err
      });
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

  // Carica progetti recenti e tutti i progetti ogni volta che si entra nella landing
  useEffect(() => {
    if (appState === 'landing') {
      fetchRecentProjects();
      fetchAllProjects(); // Carica anche tutti i progetti per la vista "tutti"
    }
  }, [appState, fetchRecentProjects, fetchAllProjects]);

  // ✅ Applica font globali dallo store
  const { combinedClass } = useFontClasses();

  return (
    <div className={`min-h-screen ${combinedClass}`} style={{ position: 'relative' }}>
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
      {/* Main App: Toolbar a tutta larghezza + Sidebar collassabile + FlowEditor */}
      {appState === 'mainApp' && (
        <div className="flex flex-col h-screen">
          {/* Toolbar a tutta larghezza */}
          <Toolbar
              onHome={() => setAppState('landing')}
              isSaving={isCreatingProject}
              currentProject={currentProject}
              onSave={async () => {
                try {
                  // show spinner in toolbar while saving
                  setIsCreatingProject(true);
                  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  const pid = pdUpdate.getCurrentProjectId();
                  if (!pid) {
                    console.warn('[Save] No project ID available');
                    return;
                  }
                  console.log('[Save] ═══════════════════════════════════════════════════════');
                  console.log('[Save] 🚀 START SAVE PROJECT', { projectId: pid, timestamp: new Date().toISOString() });
                  console.log('[Save] ═══════════════════════════════════════════════════════');

                  // FIX: Emetti evento per salvare modifiche in corso negli editor aperti
                  window.dispatchEvent(new CustomEvent('project:save', {
                    detail: { projectId: pid }
                  }));

                  // ✅ OPTIMIZATION: Parallelize all independent save operations
                  const saveStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

                  const saveResults = await Promise.allSettled([
                    // 1. Update catalog timestamp
                    (async () => {
                      const tStart = performance.now();
                      try {
                        console.log('[Save][1-catalog] 🚀 START');
                        await fetch('/api/projects/catalog/update-timestamp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            projectId: pid,
                            ownerCompany: currentProject?.ownerCompany || null,
                            ownerClient: currentProject?.ownerClient || null
                          })
                        });
                        const tEnd = performance.now();
                        console.log('[Save][1-catalog] ✅ DONE', { ms: Math.round(tEnd - tStart) });
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][1-catalog] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })(),

                    // 2. Save translations
                    (async () => {
                      if (!pid) return;
                      const tStart = performance.now();
                      try {
                        console.log('[Save][2-translations] 🚀 START');
                        const translationsContext = (window as any).__projectTranslationsContext;
                        if (translationsContext?.saveAllTranslations) {
                          await translationsContext.saveAllTranslations();
                          const tEnd = performance.now();
                          console.log('[Save][2-translations] ✅ DONE', { ms: Math.round(tEnd - tStart) });
                        } else {
                          const tEnd = performance.now();
                          console.warn('[Save][2-translations] ⚠️ Context not available', { ms: Math.round(tEnd - tStart) });
                        }
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][2-translations] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })(),

                    // 3. Save tasks
                    (async () => {
                      if (!pid) return;
                      const tStart = performance.now();
                      try {
                        console.log('[Save][3-tasks] 🚀 START');
                        const { taskRepository } = await import('../services/TaskRepository');
                        const tasksCount = taskRepository.getInternalTasksCount();
                        console.log('[Save][3-tasks] 📊 Tasks to save', { count: tasksCount });
                        const saved = await taskRepository.saveAllTasksToDatabase(pid);
                        const tEnd = performance.now();
                        if (saved) {
                          console.log('[Save][3-tasks] ✅ DONE', { ms: Math.round(tEnd - tStart), tasksCount });
                        } else {
                          console.warn('[Save][3-tasks] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), tasksCount });
                        }
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][3-tasks] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })(),

                    // 4. Save variable mappings
                    (async () => {
                      if (!pid) return;
                      const tStart = performance.now();
                      try {
                        console.log('[Save][4-mappings] 🚀 START');
                        const { flowchartVariablesService } = await import('../services/FlowchartVariablesService');
                        const stats = flowchartVariablesService.getStats();
                        console.log('[Save][4-mappings] 📊 Mappings to save', stats);
                        const mappingsSaved = await flowchartVariablesService.saveToDatabase(pid);
                        const tEnd = performance.now();
                        if (mappingsSaved) {
                          console.log('[Save][4-mappings] ✅ DONE', { ms: Math.round(tEnd - tStart), stats });
                        } else {
                          console.warn('[Save][4-mappings] ⚠️ FAILED', { ms: Math.round(tEnd - tStart), stats });
                        }
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][4-mappings] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })(),

                    // 5. Save acts and conditions
                    (async () => {
                      if (!pid || !projectData) return;
                      const tStart = performance.now();
                      try {
                        console.log('[Save][5-acts-conditions] 🚀 START');
                        const actsCount = projectData?.agentActs?.flatMap((cat: any) => cat.items || []).length || 0;
                        const conditionsCount = projectData?.conditions?.flatMap((cat: any) => cat.items || []).length || 0;
                        console.log('[Save][5-acts-conditions] 📊 Items to save', { actsCount, conditionsCount });

                        const tActs = performance.now();
                        await (ProjectDataService as any).saveProjectActsToDb?.(pid, projectData);
                        const tActsEnd = performance.now();
                        console.log('[Save][5-acts] ✅ DONE', { ms: Math.round(tActsEnd - tActs), actsCount });

                        const tCond = performance.now();
                        await (ProjectDataService as any).saveProjectConditionsToDb?.(pid, projectData);
                        const tCondEnd = performance.now();
                        console.log('[Save][5-conditions] ✅ DONE', { ms: Math.round(tCondEnd - tCond), conditionsCount });

                        // Reload fresh project data so act.problem is populated from DB
                        const tReload = performance.now();
                        let tReloadEnd = tReload;
                        try {
                          const fresh = await (ProjectDataService as any).loadProjectData?.();
                          tReloadEnd = performance.now();
                          console.log('[Save][5-reload] ✅ DONE', { ms: Math.round(tReloadEnd - tReload) });
                          if (fresh) {
                            try { pdUpdate.setData && (pdUpdate as any).setData(fresh); } catch { }
                          }
                        } catch (e) {
                          tReloadEnd = performance.now();
                          console.error('[Save][5-reload] ❌ ERROR', { ms: Math.round(tReloadEnd - tReload), error: e });
                        }

                        const tEnd = performance.now();
                        console.log('[Save][5-acts-conditions] ✅ DONE', {
                          totalMs: Math.round(tEnd - tStart),
                          actsMs: Math.round(tActsEnd - tActs),
                          conditionsMs: Math.round(tCondEnd - tCond),
                          reloadMs: Math.round(tReloadEnd - tReload)
                        });
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][5-acts-conditions] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })(),

                    // 6. Save flow
                    (async () => {
                      if (!pid) return;
                      const tStart = performance.now();
                      try {
                        console.log('[Save][6-flow] 🚀 START');
                        const svc = await import('../services/FlowPersistService');
                        const tFlush = performance.now();
                        await svc.flushFlowPersist();
                        const tFlushEnd = performance.now();
                        console.log('[Save][6-flow][flush] ✅ DONE', { ms: Math.round(tFlushEnd - tFlush) });

                        // Final PUT immediate (explicit Save)
                        const tPut = performance.now();
                        const putRes = await fetch(`/api/projects/${encodeURIComponent(pid)}/flow?flowId=main`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(((window as any).__flows && (window as any).__flows.main) ? { nodes: (window as any).__flows.main.nodes, edges: (window as any).__flows.main.edges } : { nodes: (window as any).__flowNodes || [], edges: (window as any).__flowEdges || [] })
                        });
                        const tPutEnd = performance.now();
                        if (!putRes.ok) {
                          console.error('[Save][6-flow][put] ❌ ERROR', { ms: Math.round(tPutEnd - tPut), status: putRes.status, statusText: putRes.statusText });
                        } else {
                          console.log('[Save][6-flow][put] ✅ DONE', { ms: Math.round(tPutEnd - tPut) });
                        }

                        const tEnd = performance.now();
                        console.log('[Save][6-flow] ✅ DONE', {
                          totalMs: Math.round(tEnd - tStart),
                          flushMs: Math.round(tFlushEnd - tFlush),
                          putMs: Math.round(tPutEnd - tPut)
                        });
                      } catch (e) {
                        const tEnd = performance.now();
                        console.error('[Save][6-flow] ❌ ERROR', { ms: Math.round(tEnd - tStart), error: e });
                      }
                    })()
                  ]);

                  const saveEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  const totalMs = Math.round(saveEnd - saveStart);

                  console.log('[Save] ═══════════════════════════════════════════════════════');
                  console.log('[Save] ✅ ALL OPERATIONS COMPLETED', {
                    totalMs,
                    timestamp: new Date().toISOString(),
                    results: saveResults.map((r, i) => ({
                      operation: ['catalog', 'translations', 'tasks', 'mappings', 'acts-conditions', 'flow'][i],
                      status: r.status,
                      error: r.status === 'rejected' ? String(r.reason) : undefined
                    }))
                  });
                  console.log('[Save] ═══════════════════════════════════════════════════════');
                  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  // Removed noisy meta POST; language is already stored during bootstrap
                } catch (e) {
                  console.error('[SaveProject] commit error', e);
                } finally {
                  setIsCreatingProject(false);
                }
              }}
              onRun={() => setShowGlobalDebugger(s => !s)}
              onSettings={() => setShowBackendBuilder(true)}
            />

          {/* Area principale: Library Label + Sidebar + Canvas */}
          <div className="flex flex-1 relative overflow-hidden">
            {/* Library Label quando sidebar chiusa */}
            {isSidebarCollapsed && (
              <LibraryLabel onOpen={() => setIsSidebarCollapsed(false)} />
            )}

            {/* Sidebar con animazione slide */}
            <div
              className={`
                transition-transform duration-300 ease-in-out
                ${isSidebarCollapsed
                  ? 'transform -translate-x-full absolute left-0 h-full pointer-events-none'
                  : 'transform translate-x-0 relative pointer-events-auto'
                }
              `}
              style={{ zIndex: 40 }}
            >
              <SidebarThemeProvider>
                <Sidebar onClose={() => setIsSidebarCollapsed(true)} />
              </SidebarThemeProvider>
            </div>

            {/* Canvas */}
            <div className="flex-1 flex flex-col min-w-0">
              <div id="flow-canvas-host" style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: showGlobalDebugger ? `1fr ${debuggerWidth}px` : '1fr',
                gridTemplateRows: '1fr auto',
                position: 'relative'
              }}>
              {showBackendBuilder ? (
                <div style={{ gridColumn: '1 / -1', flex: 1, minHeight: 0 }}>
                  <BackendBuilderStudio onClose={() => setShowBackendBuilder(false)} />
                </div>
              ) : (
                <>
                  {/* Canvas - prima riga, colonna sinistra */}
                  <div style={{ position: 'relative', gridRow: '1', gridColumn: '1' }}>
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
                        nodes={(window as any).__flowNodes || []}
                        setNodes={(updater: any) => {
                          try {
                            const current = (window as any).__flowNodes || [];
                            const updated = typeof updater === 'function' ? updater(current) : updater;
                            (window as any).__flowNodes = updated;
                          } catch { }
                        }}
                        edges={(window as any).__flowEdges || []}
                        setEdges={(updater: any) => {
                          try {
                            const current = (window as any).__flowEdges || [];
                            const updated = typeof updater === 'function' ? updater(current) : updater;
                            (window as any).__flowEdges = updated;
                          } catch { }
                        }}
                        currentProject={currentProject}
                        setCurrentProject={setCurrentProject}
                        onPlayNode={onPlayNode}
                        testPanelOpen={testPanelOpen}
                        setTestPanelOpen={setTestPanelOpen}
                        testNodeId={testNodeId}
                        setTestNodeId={setTestNodeId}
                      />
                    )}
                  </div>

                  {/* Act Editor + Condition Editor - seconda riga, colonna sinistra (solo sotto canvas) */}
                  <div style={{ gridRow: '2', gridColumn: '1', minHeight: 0, position: 'relative' }}>
                    <ActEditorPanel />
                    <ConditionEditor
                      open={conditionEditorOpen}
                      onClose={() => {
                        setConditionEditorOpen(false);
                        // Restore previous viewport position
                        setTimeout(() => {
                          try {
                            document.dispatchEvent(new CustomEvent('flowchart:restoreViewport', { bubbles: true }));
                          } catch (err) {
                            console.warn('[ConditionEditor] Failed to emit restore viewport event', err);
                          }
                        }, 100);
                      }}
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
                </>
              )}
              {showGlobalDebugger && (
                <>
                  {/* Resizer verticale */}
                  <div
                    onMouseDown={handleResizeStart}
                    style={{
                      position: 'absolute',
                      left: `calc(100% - ${debuggerWidth}px - 4px)`,
                      top: 0,
                      bottom: 0,
                      width: '8px',
                      cursor: 'col-resize',
                      backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                      zIndex: 10,
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isResizing) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#e5e7eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizing) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  />

                  {/* Pannello di debug - colonna destra, span su 2 righe (tutta l'altezza) */}
                  <div
                    style={{
                      gridRow: '1 / -1',
                      gridColumn: '2',
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      borderLeft: '1px solid #e5e7eb'
                    }}
                  >
                    <DDEBubbleChat
                      mode="flow"
                      // nodes and edges are read directly from window.__flowNodes in flow mode
                    />
                  </div>
                </>
              )}
              </div>

            {nonInteractiveEditor && (
              <ResizableNonInteractiveEditor
                title={nonInteractiveEditor.title}
                value={nonInteractiveEditor.value}
                instanceId={niSource?.instanceId}
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
                      // Update instance in memory (already done by NonInteractiveResponseEditor via updateMessage)
                      // Just persist to database
                      void dataSvc.updateInstance(pid, niSource.instanceId, { message: { text } })
                        .then(() => {
                          try {
                            console.log('[NI][close][PUT ok]', { instanceId: niSource?.instanceId, text });
                            // FASE 2: Update Task (TaskRepository sincronizza automaticamente con InstanceRepository)
                            const { taskRepository } = require('../services/TaskRepository');
                            taskRepository.updateTaskValue(niSource.instanceId, { text }, pid);
                          } catch { }
                        })
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
        </div>
      )}
    </div>
  );
};

// Panel that renders the ActEditorHost when an act is selected via context
// Rendered in normal document flow (not overlay) to push canvas up
function ActEditorPanel() {
  const ctx = useActEditor();

  // Bridge DOM event → context.open to allow callers to emit without importing the hook
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      if (d && d.id && d.type) ctx.open(d);
    };
    document.addEventListener('actEditor:open', handler as any);
    return () => document.removeEventListener('actEditor:open', handler as any);
  }, [ctx]);

  if (!ctx.act) {
    return null;
  }

  // ✅ Render normale nel flusso del documento - questo riduce automaticamente lo spazio del canvas sopra
  // Il canvas con flex: 1 si restringerà per fare spazio a questo elemento
  return (
    <div style={{
      width: '100%',
      backgroundColor: '#0b1220',
      flexShrink: 0, // Non si restringe, mantiene la sua altezza
      minHeight: 0
    }}>
      <ResizableActEditorHost act={ctx.act} onClose={ctx.close} />
    </div>
  );
}