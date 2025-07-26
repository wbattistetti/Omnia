import React, { useState } from 'react';
import { DockPanel } from './TestEngine/DockPanel';
import { ChatPanel } from './TestEngine/ChatPanel';
import { ProjectDataProvider, useProjectData } from '../context/ProjectDataContext';
import { ProjectData } from '../types/project';
import { AppContent } from './AppContent';
import { ActionsCatalogProvider, useSetActionsCatalog } from '../context/ActionsCatalogContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DDTProvider } from '../context/DDTContext';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

function AppInner() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testNodeId, setTestNodeId] = useState<string | null>(null);
  const [testNodeRows, setTestNodeRows] = useState<any[]>([]); // nuovo stato
  const { data: projectData } = useProjectData();
  // Prendi tutti gli agentActs come flat array
  const agentActs = projectData?.agentActs?.flatMap(cat => cat.items) || [];

  // Stato chat spostato qui
  const [userReplies, setUserReplies] = useState<(string | undefined)[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showChat, setShowChat] = useState(true); // nuovo stato
  const { setActionsCatalog } = useSetActionsCatalog();

  React.useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(data => setActionsCatalog(data))
      .catch(err => {
        setActionsCatalog([]);
        console.error('[App][ERROR] fetch actionsCatalog', err);
      });
  }, [setActionsCatalog]);

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
    <ProjectDataProvider>
      <ActionsCatalogProvider>
        <DndProvider backend={HTML5Backend}>
          <DDTProvider>
            <AppInner />
          </DDTProvider>
        </DndProvider>
      </ActionsCatalogProvider>
    </ProjectDataProvider>
  );
}