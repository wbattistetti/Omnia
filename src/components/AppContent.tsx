import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { NewProjectModal } from './NewProjectModal';
import { Sidebar } from './Sidebar/Sidebar';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectDataUpdate } from '../context/ProjectDataContext';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from './Flowchart/FlowEditor';
import { ProjectInfo } from '../types/project';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
import ActEditor from './ActEditor';
import { DockablePanelsHandle } from './DockablePanels';
import DockablePanels from './DockablePanels';
import { FlowEditor } from './Flowchart/FlowEditor';

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
  // Stato globale per nodi e edge
  const [nodesState, setNodes] = useState<Node<NodeData>[]>([]);
  const [edgesState, setEdges] = useState<Edge<EdgeData>[]>([]);
  // Memo per garantire reference stabile
  const nodes = useMemo(() => nodesState, [nodesState]);
  const edges = useMemo(() => edgesState, [edgesState]);
  // Stato per feedback salvataggio
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Stato per gestione progetti
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per finestre editor DDT aperte (ora con react-mosaic)
  const [mosaicNodes, setMosaicNodes] = useState<any>(null);
  const dockablePanelsRef = React.useRef<DockablePanelsHandle>(null);

  // Step 1: Stato dei pannelli dockabili

  type PanelType = 'canvas' | 'responseEditor';

  interface PanelData {
    id: string;
    type: PanelType;
    title: string;
    params?: any;
  }

  const [openPanels, setOpenPanels] = useState<PanelData[]>([
    { id: 'canvas', type: 'canvas', title: 'Flowchart' }
  ]);

  const flowEditorProps = {
    nodes,
    setNodes,
    edges,
    setEdges,
    currentProject,
    setCurrentProject,
    onPlayNode,
    testPanelOpen,
    setTestPanelOpen,
    testNodeId,
    setTestNodeId
  };

  // LOG SENTINELLA: mount/unmount
  useEffect(() => {
    console.log('[AppContent] MOUNTED');
    return () => {
      console.log('[AppContent] UNMOUNTED');
    };
  }, []);

  // LOG SENTINELLA: cambi di appState
  useEffect(() => {
    console.log('[AppContent] appState changed:', appState);
  }, [appState]);

  // Log useEffect su nodes/edges
  useEffect(() => {
    console.log('[AppContent] useEffect nodes/edges', { nodes, edges });
  }, [nodes, edges]);

  // Log useEffect su showAllProjectsModal
  useEffect(() => {
    console.log('[AppContent] useEffect showAllProjectsModal', showAllProjectsModal);
  }, [showAllProjectsModal]);

  // Log useEffect su appState per fetchRecentProjects
  useEffect(() => {
    if (appState === 'landing') {
      console.log('[AppContent] useEffect appState landing: fetchRecentProjects');
      fetchRecentProjects();
    }
  }, [appState]);

  // Log ogni chiamata a setAppState
  const setAppStateLogged = (state: AppState) => {
    console.log('[AppContent] setAppState called:', state);
    setAppState(state);
  };

  // Log ogni chiamata a setNodes
  const setNodesLogged = useCallback((value: Node<NodeData>[] | ((prev: Node<NodeData>[]) => Node<NodeData>[])) => {
    console.log('[AppContent] setNodes called:', value);
    setNodes(value);
  }, []);

  // Log ogni chiamata a setEdges
  const setEdgesLogged = useCallback((value: Edge<EdgeData>[] | ((prev: Edge<EdgeData>[]) => Edge<EdgeData>[])) => {
    console.log('[AppContent] setEdges called:', value);
    setEdges(value);
  }, []);

  const { refreshData } = useProjectDataUpdate();
  // Wrap refreshData per log
  const refreshDataWithLog = async () => {
    console.log('[refreshDataWithLog] called');
    await refreshData();
    console.log('[refreshDataWithLog] done');
  };

  // Step 2: Funzioni per aprire/chiudere pannelli
  const openPanel = (panel: PanelData) => {
    setOpenPanels(panels => panels.some(p => p.id === panel.id) ? panels : [...panels, panel]);
  };

  const closePanel = (id: string) => {
    setOpenPanels(panels => panels.filter(p => p.id !== id && p.type !== 'canvas'));
  };

  // handleOpenDDTEditor ora usa openPanel
  const handleOpenDDTEditor = (ddt: any, translations: any, lang: string) => {
    const id = ddt._id || ddt.id;
    const title = ddt.label || ddt.name || id;
    openPanel({
      id,
      type: 'responseEditor',
      title,
      params: { ddt, translations, lang }
    });
  };

  // Pannello di test in alto a sinistra all'avvio
  React.useEffect(() => {
    if (dockablePanelsRef.current) {
      dockablePanelsRef.current.openPanel({
        id: 'test-panel',
        title: 'Test Panel',
        ddt: { label: 'Test Panel' },
        translations: {},
        lang: 'it'
      });
    }
  }, []);

  // Carica progetti recenti (ultimi 10)
  const fetchRecentProjects = async () => {
    try {
      setRecentProjects(await ProjectService.getRecentProjects());
    } catch (e) {
      setRecentProjects([]);
    }
  };
  // Carica tutti i progetti
  const fetchAllProjects = async () => {
    try {
      setAllProjects(await ProjectService.getAllProjects());
    } catch (e) {
      setAllProjects([]);
    }
  };

  // Elimina singolo progetto
  const handleDeleteProject = async (id: string) => {
    await ProjectService.deleteProject(id);
    setToast('Progetto eliminato!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  };
  // Elimina tutti i progetti
  const handleDeleteAllProjects = async () => {
    await ProjectService.deleteAllProjects();
    setToast('Tutti i progetti eliminati!');
    await fetchRecentProjects();
    await fetchAllProjects();
    setTimeout(() => setToast(null), 2000);
  };

  // Callback per LandingPage
  const handleLandingNewProject = () => {
    console.log('[setAppState] creatingProject (handleLandingNewProject)');
    setAppStateLogged('creatingProject');
  };
  const handleLandingLoadProject = async () => {
    await fetchRecentProjects();
  };
  const handleLandingShowAllProjects = async () => {
    await fetchAllProjects();
    setShowAllProjectsModal(true);
  };

  const handleOpenNewProjectModal = () => {
    console.log('[setAppState] creatingProject (handleOpenNewProjectModal)');
    setAppStateLogged('creatingProject');
  };

  const handleCreateProject = async (projectInfo: ProjectInfo): Promise<boolean> => {
    setCreateError(null);
    setIsCreatingProject(true);
    try {
      // Verifica nome univoco
      const existing = await ProjectService.getProjectByName(projectInfo.name);
      if (existing) {
        setCreateError('Esiste già un progetto con questo nome!');
        setIsCreatingProject(false);
        return false;
      }
      // Inizializza i dati di progetto dai template
      await ProjectDataService.initializeProjectData(projectInfo.template, projectInfo.language);
      const templateDicts = await ProjectDataService.loadProjectData();
      // Crea il nuovo progetto con info base e dizionari copiati
      const newProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        agentActs: JSON.parse(JSON.stringify(templateDicts.agentActs)),
        userActs: JSON.parse(JSON.stringify(templateDicts.userActs)),
        backendActions: JSON.parse(JSON.stringify(templateDicts.backendActions)),
        conditions: JSON.parse(JSON.stringify(templateDicts.conditions)),
        tasks: JSON.parse(JSON.stringify(templateDicts.tasks)),
        macrotasks: JSON.parse(JSON.stringify(templateDicts.macrotasks)),
        industry: (templateDicts.industry || 'defaultIndustry'),
      };
      console.log('[handleCreateProject] newProject:', newProject);
      setCurrentProject(newProject);
      await ProjectDataService.importProjectData(JSON.stringify(newProject));
      setNodesLogged([{
        id: '1',
        type: 'custom',
        position: { x: 250, y: 150 },
        data: { title: 'Nodo iniziale', rows: [] }
      }]);
      console.log('[handleCreateProject] setNodes([Nodo iniziale])');
      setEdgesLogged([]); console.log('[handleCreateProject] setEdges([])');
      console.log('[handleCreateProject] calling refreshData');
      await refreshData();
      console.log('[handleCreateProject] setAppState(mainApp)');
      setAppStateLogged('mainApp');
      return true;
    } catch (e) {
      setCreateError('Errore nella creazione del progetto');
      return false;
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleCloseNewProjectModal = () => {
    console.log('[setAppState] landing (handleCloseNewProjectModal)');
    setAppStateLogged('landing');
  };

  const handleSaveProject = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const {
        agentActs,
        userActs,
        backendActions,
        conditions,
        tasks,
        macrotasks,
        ...rest
      } = currentProject;
      const response = await fetch('http://localhost:3100/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          agentActs,
          userActs,
          backendActions,
          conditions,
          tasks,
          macrotasks,
          nodes,
          edges
        }),
      });
      if (!response.ok) throw new Error('Errore nel salvataggio');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError('Salvataggio fallito');
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowRecentProjects = async (id?: string) => {
    if (id) {
      await handleOpenProjectById(id);
      console.log('[setAppState] mainApp (handleShowRecentProjects, id)');
      setAppStateLogged('mainApp');
      return;
    }
    try {
      const response = await fetch('http://localhost:3100/projects');
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
      console.log('[setAppState] mainApp (handleShowRecentProjects, prompt)');
      setAppStateLogged('mainApp');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  };

  const handleOpenProjectById = async (id: string) => {
    if (!id) return;
    try {
      const response = await fetch(`http://localhost:3100/projects/${id}`);
      if (!response.ok) throw new Error('Errore nel caricamento');
      const project = await response.json();
      console.log('[handleOpenProjectById] loaded project:', project);
      setCurrentProject(project); // carica TUTTI i dati, inclusi i dizionari
      setNodesLogged(Array.isArray(project.nodes) ? project.nodes : []);
      console.log('[handleOpenProjectById] setNodes:', Array.isArray(project.nodes) ? project.nodes : []);
      setEdgesLogged(Array.isArray(project.edges) ? project.edges : []);
      console.log('[handleOpenProjectById] setEdges:', Array.isArray(project.edges) ? project.edges : []);
      await ProjectDataService.importProjectData(JSON.stringify(project));
      console.log('[handleOpenProjectById] after importProjectData');
      await refreshData();
      console.log('[handleOpenProjectById] after refreshData');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  };

  // Passa una funzione a NewProjectModal per azzerare l'errore duplicato quando cambia il nome
  const handleProjectNameChange = () => {
    if (createError) setCreateError(null);
  };

  // Carica progetti recenti ogni volta che si entra nella landing
  useEffect(() => {
    if (appState === 'landing') {
      fetchRecentProjects();
    }
  }, [appState]);

  useEffect(() => {
    if (showAllProjectsModal) {
      fetchAllProjects();
    }
  }, [showAllProjectsModal]);

  const flowContainerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    console.log('[AppContent] flowContainerRef:', flowContainerRef.current);
    console.log('[AppContent] dockablePanelsRef:', dockablePanelsRef.current);
  }, [appState]);

  // Loggo la fase di render dei blocchi principali
  if (appState === 'mainApp') {
    console.log('[AppContent] Sidebar render');
    console.log('[AppContent] FlowEditor container render');
    console.log('[AppContent] FlowEditor render');
    console.log('[AppContent] DockablePanels render');
  }

  // DebugDiv per loggare mount/unmount del parent di DockablePanels
  const DebugDiv: React.FC<{children: React.ReactNode}> = ({children}) => {
    React.useEffect(() => {
      console.log('[DebugDiv] MOUNTED');
      return () => console.log('[DebugDiv] UNMOUNTED');
    }, []);
    return <div className="flex-1 relative" style={{ height: '100vh', minHeight: 400, background: '#fff' }}>{children}</div>;
  };

  // DebugMainApp per loggare mount/unmount del contenitore principale di mainApp
  const DebugMainApp: React.FC<{children: React.ReactNode}> = ({children}) => {
    React.useEffect(() => {
      console.log('[DebugMainApp] MOUNTED');
      return () => console.log('[DebugMainApp] UNMOUNTED');
    }, []);
    return <div className="min-h-screen bg-slate-900 flex flex-col">{children}</div>;
  };

  // reference checker
  const prevNodesRef = useRef(nodes);
  useEffect(() => {
    console.log("[AppContent] nodes === prev:", nodes === prevNodesRef.current);
    prevNodesRef.current = nodes;
  }, [nodes]);

  console.log("[Render] AppContent");

  return (
    <DebugMainApp>
      <DebugDiv>
        <FlowEditor
          nodes={nodes}
          setNodes={setNodesLogged}
          edges={edges}
          setEdges={setEdgesLogged}
          currentProject={currentProject}
          setCurrentProject={setCurrentProject}
          onPlayNode={onPlayNode}
          testPanelOpen={testPanelOpen}
          setTestPanelOpen={setTestPanelOpen}
          testNodeId={testNodeId}
          setTestNodeId={setTestNodeId}
        />
      </DebugDiv>
    </DebugMainApp>
  );
};