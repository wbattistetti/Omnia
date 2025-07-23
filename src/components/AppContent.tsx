import React, { useState, useRef } from 'react';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { NewProjectModal } from './NewProjectModal';
import { Sidebar } from './Sidebar/Sidebar';
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
import ResponseEditor from './ActEditor/ResponseEditor/ResponseEditor';

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
  const [selectedDDT, setSelectedDDT] = useState<any | null>(null);
  const [selectedDDTTranslations, setSelectedDDTTranslations] = useState<any | null>(null);
  const [selectedDDTLanguage, setSelectedDDTLanguage] = useState<string>('it');

  const handleOpenDDTEditor = (ddt: any, translations: any, lang: string) => {
    setSelectedDDT(ddt);
    setSelectedDDTTranslations(translations);
    setSelectedDDTLanguage(lang);
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
  const handleLandingNewProject = () => setAppState('creatingProject');
  const handleLandingLoadProject = async () => {
    await fetchRecentProjects();
  };
  const handleLandingShowAllProjects = async () => {
    await fetchAllProjects();
    setShowAllProjectsModal(true);
  };

  const handleOpenNewProjectModal = () => {
    setAppState('creatingProject');
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
  };

  const handleCloseNewProjectModal = () => {
    setAppState('landing');
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
      setAppState('mainApp');
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
      setAppState('mainApp');
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
      setCurrentProject(project); // carica TUTTI i dati, inclusi i dizionari
      // AGGIUNTA: aggiorna anche nodi e edge se presenti
      setNodes(Array.isArray(project.nodes) ? project.nodes : []);
      setEdges(Array.isArray(project.edges) ? project.edges : []);
      await ProjectDataService.importProjectData(JSON.stringify(project));
      await refreshData();
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
  });

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
          />
        </>
      )}
      {/* Main App: Sidebar + FlowEditor */}
      {appState === 'mainApp' && (
        <div className="min-h-screen flex">
          <SidebarThemeProvider>
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              onOpenDDTEditor={handleOpenDDTEditor}
            />
          </SidebarThemeProvider>
          <div className="flex-1 flex flex-col">
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
              <ResponseEditor
                ddt={selectedDDT}
                translations={selectedDDTTranslations}
                lang={selectedDDTLanguage}
                onClose={() => setSelectedDDT(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};