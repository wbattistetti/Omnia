import React, { useState } from 'react';
import { enableDebug } from '../utils/logger';
import { DockPanel } from './TestEngine/DockPanel';
import { ChatPanel } from './TestEngine/ChatPanel';
import { ProjectDataProvider } from '../context/ProjectDataContext';
import { ProjectData } from '../types/project';
import { AppContent } from './AppContent';
import { ActionsCatalogProvider, useSetActionsCatalog } from '../context/ActionsCatalogContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DDTProvider } from '../context/DDTContext';
import { DDTManagerProvider } from '../context/DDTManagerContext';
import { ProjectTranslationsProvider } from '../context/ProjectTranslationsContext';
import { ThemeProvider } from '../theme/components/ThemeProvider';
import { ActEditorProvider } from './ActEditor/EditorHost/ActEditorContext';
import { SpeechRecognitionProvider } from '../context/SpeechRecognitionContext';
import { AIProviderProvider } from '../context/AIProviderContext';
import { InMemoryConditionsProvider } from '../context/InMemoryConditionsContext';
import { BackendTypeProvider } from '../context/BackendTypeContext';
import { TypeTemplateService } from '../services/TypeTemplateService';
import { taskTemplateService } from '../services/TaskTemplateService';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TemplateTranslationsService } from '../services/TemplateTranslationsService';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

function AppInner() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Inizia chiusa di default
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testNodeId, setTestNodeId] = useState<string | null>(null);
  const [testNodeRows, setTestNodeRows] = useState<any[]>([]); // nuovo stato
  // Note: avoid reading ProjectData context here to keep HMR boundaries stable

  // Stato chat spostato qui
  const [userReplies, setUserReplies] = useState<(string | undefined)[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showChat, setShowChat] = useState(true); // nuovo stato
  const { setActionsCatalog } = useSetActionsCatalog();

  // Tasks are loaded when a project is opened (in AppContent.tsx)

  React.useEffect(() => {
    // Load actions from Task_Templates with taskType='Action' instead of static JSON
    fetch('/api/factory/task-templates?taskType=Action')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(templates => {
        // Convert Task_Templates format to actionsCatalog format for backward compatibility
        const actionsCatalog = templates.map((template: any) => ({
          id: template.id || template._id,
          label: template.label || '',
          description: template.description || '',
          icon: template.icon || 'Circle',
          color: template.color || 'text-gray-500',
          params: template.structure || template.params || {}
        }));
        setActionsCatalog(actionsCatalog);
        try { (window as any).__actionsCatalog = actionsCatalog; } catch { }
      })
      .catch(err => {
        console.warn('[App] Failed to load actions from Task_Templates, falling back to actionsCatalog.json', err);
        // Fallback to static JSON if database fails
        fetch('/data/actionsCatalog.json')
          .then(res => res.json())
          .then(data => { setActionsCatalog(data); try { (window as any).__actionsCatalog = data; } catch { } })
          .catch(fallbackErr => {
            setActionsCatalog([]);
            console.error('[App][ERROR] fetch actionsCatalog fallback', fallbackErr);
          });
      });
  }, [setActionsCatalog]);

  // Enable central logger globally for this session
  React.useEffect(() => {
    try {
      enableDebug();
      (window as any).Logger?.setLevel('debug');
      (window as any).Logger?.enableComponent('ALL');
    } catch { }
  }, []);

  // Load act type patterns from database at startup
  React.useEffect(() => {
    import('../nlp/actType/registry').then(module => {
      module.initializeRegistry().catch(err => {
        console.warn('[App] Failed to load act type patterns from database, using fallback:', err);
      });
    });
  }, []);

  // ✅ Precarica tutte le cache in parallelo all'avvio (non blocca il rendering)
  React.useEffect(() => {
    // Ottieni lingua del progetto corrente
    const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';

    Promise.all([
      TypeTemplateService.loadTemplates().catch(() => null),
      DialogueTaskService.loadTemplates().catch(() => []),
      taskTemplateService.getAllTemplates().catch(() => null),
      TemplateTranslationsService.loadForLanguage(projectLang).catch(() => null),
      import('../services/DDTPatternService').then(module => module.DDTPatternService.loadPatterns().catch(() => ({})))
    ]).catch(() => {
      // Silently handle errors - cache preload is non-critical
    });
  }, []); // Solo all'avvio

  // Callback da passare ai nodi
  const handlePlayNode = (nodeId: string, nodeRows: any[]) => {
    setTestNodeId(nodeId);
    setTestNodeRows(nodeRows || []);
    setTestPanelOpen(true);
    setShowChat(true); // mostra la chat quando si avvia il test
  };

  // Funzione per clear chat
  const handleClearChat = () => {
    setUserReplies([]);
    setInputValue('');
    setShowChat(false); // nascondi tutto
  };

  // Funzione per invio risposta
  const handleSend = (currentPromptIdx: number | undefined) => {
    if (!inputValue.trim() || currentPromptIdx === undefined) return;
    const newReplies = [...userReplies];
    newReplies[currentPromptIdx] = inputValue;
    setUserReplies(newReplies);
    setInputValue('');
    setShowChat(true); // ri-mostra la chat se era stata svuotata
  };

  return (
    <>
      <AppContent
        appState={appState}
        setAppState={setAppState}
        currentProject={currentProject}
        setCurrentProject={(project) => setCurrentProject(project as any)}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        testPanelOpen={testPanelOpen}
        setTestPanelOpen={setTestPanelOpen}
        testNodeId={testNodeId}
        setTestNodeId={setTestNodeId}
        onPlayNode={(nodeId) => handlePlayNode(nodeId, [])}
      />
      {/* Bottone flottante per aprire il test engine */}
      <button
        className="fixed right-4 bottom-4 z-40 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700"
        onClick={() => setTestPanelOpen(true)}
        aria-label="Apri Test Engine"
      >
        🧪
      </button>
      <DockPanel open={testPanelOpen} onClose={() => setTestPanelOpen(false)} onClear={handleClearChat}>
        {testPanelOpen && showChat && (
          <ChatPanel
            // agentActs={agentActs} // Remove or fix this line if ChatPanelProps does not expect agentActs
            testNodeId={testNodeId}
            userReplies={userReplies}
            setUserReplies={setUserReplies}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSend={handleSend}
            onClear={handleClearChat}
            showChat={showChat}
            nodeRows={testNodeRows}
          />
        )}
      </DockPanel>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ProjectDataProvider>
        <ProjectTranslationsProvider>
          <AIProviderProvider>
            <ActionsCatalogProvider>
            <DndProvider backend={HTML5Backend}>
              <SpeechRecognitionProvider>
                <DDTProvider>
                  <DDTManagerProvider>
                    <ActEditorProvider>
                      <InMemoryConditionsProvider>
                        <BackendTypeProvider>
                          <AppInner />
                        </BackendTypeProvider>
                      </InMemoryConditionsProvider>
                    </ActEditorProvider>
                  </DDTManagerProvider>
                </DDTProvider>
              </SpeechRecognitionProvider>
            </DndProvider>
          </ActionsCatalogProvider>
        </AIProviderProvider>
        </ProjectTranslationsProvider>
      </ProjectDataProvider>
    </ThemeProvider>
  );
}