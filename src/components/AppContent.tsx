import React, { useState, useCallback } from 'react';
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
// import ActEditor from './ActEditor';
// import { DockablePanelsHandle } from './DockablePanels';
// import DockablePanels from './DockablePanels';
import { FlowEditor } from './Flowchart/FlowEditor';
import BackendBuilderStudio from '../BackendBuilder/ui/Studio';
import ResizableResponseEditor from './ActEditor/ResponseEditor/ResizableResponseEditor';
import ResizableNonInteractiveEditor from './ActEditor/ResponseEditor/ResizableNonInteractiveEditor';
import FlowRunner from './debugger/FlowRunner';
import { useDDTContext } from '../context/DDTContext';
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
  // Safe access: avoid calling context hook if provider not mounted (e.g., during hot reload glitches)
  let refreshData: () => Promise<void> = async () => {};
  try {
    const ctx = useProjectDataUpdate();
    refreshData = ctx.refreshData;
  } catch (e) {
    // Provider not available yet; use no-op and rely on provider after mount
    refreshData = async () => {};
  }
  const ddtContext = useDDTContext();
  const getTranslationsForDDT = ddtContext.getTranslationsForDDT;
  // const setTranslationsForDDT = ddtContext.setTranslationsForDDT;

  // Usa il nuovo hook per DDT
  const { selectedDDT, closeDDT } = useDDTManager();
  const [nonInteractiveEditor, setNonInteractiveEditor] = useState<null | { title?: string; value: { template: string; vars?: string[]; samples?: Record<string,string> }; accentColor?: string }>(null);

  // Listen to open event for non-interactive acts (open bottom panel like ResponseEditor)
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      // Expected: { title?: string, template?: string, accentColor?: string }
      setNonInteractiveEditor({ title: d.title || 'Agent message', value: { template: d.template || '', samples: {}, vars: [] } as any, accentColor: d.accentColor });
    };
    document.addEventListener('nonInteractiveEditor:open', handler as any);
    return () => document.removeEventListener('nonInteractiveEditor:open', handler as any);
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

  // Listen to Sidebar wrench
  React.useEffect(() => {
    const handler = () => setShowBackendBuilder(true);
    document.addEventListener('backendBuilder:open', handler);
    return () => document.removeEventListener('backendBuilder:open', handler);
  }, []);

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

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

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
              onSave={async () => {
                try {
                  // Load current in-memory Agent Acts and send them all to backend for full replace
                  const svc = await import('../services/ProjectDataService');
                  const data = await (svc as any).ProjectDataService.loadProjectData();
                  const cats = (data?.agentActs || []) as any[];
                  const allActs: any[] = [];
                  for (const c of cats) {
                    for (const it of (c.items || [])) {
                      allActs.push({
                        _id: it._id || it.id,
                        label: it.name,
                        description: it.description || '',
                        category: c.name,
                        isInteractive: it.isInteractive ?? false,
                        data: it.data || {},
                        ddt: it.ddt || null
                      });
                    }
                  }
                  const res = await fetch('/api/factory/agent-acts/bulk-replace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(allActs)
                  });
                  if (!res.ok) throw new Error('bulk replace failed');
                  const result = await res.json();
                  console.log('[SaveProject] AgentActs bulk replaced:', result);
                  alert('Progetto salvato (Agent Acts sovrascritti)');
                } catch (e) {
                  console.error('[SaveProject] error', e);
                  alert('Errore nel salvataggio del progetto');
                }
              }}
              onRun={() => setShowGlobalDebugger(s => !s)}
              onSettings={() => setShowBackendBuilder(true)}
              projectName={currentProject?.name}
            />
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: showGlobalDebugger ? '1fr 380px' : '1fr' }}>
              {showBackendBuilder ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <BackendBuilderStudio onClose={() => setShowBackendBuilder(false)} />
                </div>
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
              {showGlobalDebugger && (
                <FlowRunner nodes={nodes} edges={edges} />
              )}
            </div>
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
            {!selectedDDT && nonInteractiveEditor && (
              <ResizableNonInteractiveEditor
                title={nonInteractiveEditor.title}
                value={nonInteractiveEditor.value}
                onChange={(next) => {
                  // Only update local draft; persist on close
                  setNonInteractiveEditor({ title: nonInteractiveEditor.title, value: next, accentColor: (nonInteractiveEditor as any).accentColor });
                }}
                onClose={async () => {
                  try {
                    const svc = await import('../services/ProjectDataService');
                    const dataSvc: any = (svc as any).ProjectDataService;
                    const projectData: any = await dataSvc.loadProjectData();
                    const cats: any[] = (projectData?.agentActs || []) as any[];
                    for (const c of cats) {
                      const it = (c.items || []).find((i: any) => String(i?.name || '').trim() === String(nonInteractiveEditor?.title || '').trim());
                      if (it) {
                        const prompts = { ...(it.prompts || {}), informal: nonInteractiveEditor?.value?.template || '' };
                        await dataSvc.updateItem('agentActs', c.id, it.id, { prompts } as any);
                        break;
                      }
                    }
                  } catch {}
                  setNonInteractiveEditor(null);
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