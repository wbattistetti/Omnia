import React, { useState } from 'react';
import { ProjectData } from './NewProjectModal';
import { ProjectDataProvider } from '../context/ProjectDataContext';
import { AppContent } from './AppContent';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <ProjectDataProvider>
      <AppContent
        appState={appState}
        setAppState={setAppState}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
      />
    </ProjectDataProvider>
  );
}

export default App;