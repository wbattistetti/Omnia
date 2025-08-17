import React, { useState, useRef, useCallback } from 'react';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { NewProjectModal } from './NewProjectModal';
import Sidebar from './Sidebar/Sidebar';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectDataUpdate } from '../context/ProjectDataContext';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from './Flowchart/FlowEditor';
import { ProjectInfo } from '../types/project';
import { useEffect } from 'react';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
import ActEditor from './ActEditor';
import { DockablePanelsHandle } from './DockablePanels';
import DockablePanels from './DockablePanels';
import { FlowEditor } from './Flowchart/FlowEditor';
import ResizableResponseEditor from './ActEditor/ResponseEditor/ResizableResponseEditor';
import { useDDTContext, useSetDDTContext } from '../context/DDTContext';
import { useDDTManager } from '../context/DDTManagerContext';

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
  const { refreshData } = useProjectDataUpdate();
  const ddtContext = useDDTContext();
  const getTranslationsForDDT = ddtContext.getTranslationsForDDT;
  const setTranslationsForDDT = ddtContext.setTranslationsForDDT;

  // Usa il nuovo hook per DDT
  const { selectedDDT, closeDDT } = useDDTManager();

  // Stato globale per nodi e edge
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge<EdgeData>[]>([]);
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
  const handleLandingLoadProject = useCallback(async () => { await fetchRecentProjects(); }, [fetchRecentProjects]);
  const handleLandingShowAllProjects = useCallback(async () => { await fetchAllProjects(); setShowAllProjectsModal(true); }, [fetchAllProjects]);

  const handleOpenNewProjectModal = useCallback(() => setAppState('creatingProject'), [setAppState]);

  const handleCreateProject = useCallback(async (projectInfo: ProjectInfo): Promise<boolean> => {
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
      setCurrentProject(newProject);
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

  const handleSaveProject = useCallback(async () => {
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
      const response = await fetch('/projects', {
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
  }, [currentProject, nodes, edges]);

  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const response = await fetch(`/projects/${id}`);
      if (!response.ok) throw new Error('Errore nel caricamento');
      const project = await response.json();
      setCurrentProject(project); // carica TUTTI i dati, inclusi i dizionari
      // AGGIUNTA: aggiorna anche nodi e edge se presenti
      setNodes(Array.isArray(project.nodes) ? project.nodes : []);
      setEdges(Array.isArray(project.edges) ? project.edges : []);
      await ProjectDataService.importProjectData(JSON.stringify(project));
      await refreshData();
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [refreshData]);

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
              onSave={() => alert('Salva progetto')}
              onRun={() => alert('Esegui')}
              onSettings={() => alert('Impostazioni')}
              projectName={currentProject?.name}
            />
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
            {selectedDDT && (
              (() => {
                const t = getTranslationsForDDT(selectedDDT.id || selectedDDT._id);
                const fallback = selectedDDT.translations;
                const translationsToUse = Object.keys(t || {}).length > 0 ? t : fallback;
                return (
                  <ResizableResponseEditor
                    ddt={selectedDDT}
                    translations={translationsToUse}
                    lang="it"
                    onClose={closeDDT}
                  />
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};