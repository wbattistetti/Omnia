import React, { useState } from 'react';
import { ProjectDataProvider } from '../context/ProjectDataContext';
import { ActionsCatalogProvider } from '../context/ActionsCatalogContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AppContent } from './AppContent';
import { ProjectData } from '../types/project';

// Definisci i possibili stati dell'app
export type AppState = 'landing' | 'creatingProject' | 'mainApp';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testNodeId, setTestNodeId] = useState<string | null>(null);

  console.log('[Render] App.tsx');

  return (
    <ProjectDataProvider>
      <ActionsCatalogProvider>
        <DndProvider backend={HTML5Backend}>
          {/* Logga la key se presente */}
          {/* AppContent non riceve key, ma loggo comunque */}
          <AppContent
            appState={appState}
            setAppState={setAppState}
            currentProject={currentProject}
            setCurrentProject={setCurrentProject}
            isSidebarCollapsed={isSidebarCollapsed}
            setIsSidebarCollapsed={setIsSidebarCollapsed}
            testPanelOpen={testPanelOpen}
            setTestPanelOpen={setTestPanelOpen}
            testNodeId={testNodeId}
            setTestNodeId={setTestNodeId}
            onPlayNode={() => {}}
          />
        </DndProvider>
      </ActionsCatalogProvider>
    </ProjectDataProvider>
  );
}