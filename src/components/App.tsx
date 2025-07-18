import React, { useState } from 'react';
import { DockPanel } from './TestEngine/DockPanel';
import { ChatPanel } from './TestEngine/ChatPanel';
import { ProjectDataProvider, useProjectData } from '../context/ProjectDataContext';
import { ProjectData } from './NewProjectModal';
import { AppContent } from './AppContent';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

function AppInner() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const { data: projectData } = useProjectData();
  // Prendi tutti gli agentActs come flat array
  const agentActs = projectData?.agentActs?.flatMap(cat => cat.items) || [];

  return (
    <>
      <AppContent
        appState={appState}
        setAppState={setAppState}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
      />
      {/* Bottone flottante per aprire il test engine */}
      <button
        className="fixed right-4 bottom-4 z-40 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700"
        onClick={() => setTestPanelOpen(true)}
        aria-label="Apri Test Engine"
      >
        🧪
      </button>
      <DockPanel open={testPanelOpen} onClose={() => setTestPanelOpen(false)}>
        <ChatPanel agentActs={agentActs} />
      </DockPanel>
    </>
  );
}

export default function App() {
  return (
    <ProjectDataProvider>
      <AppInner />
    </ProjectDataProvider>
  );
}