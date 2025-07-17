import React, { useState } from 'react';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { NewProjectModal, ProjectData } from './NewProjectModal';
import { Sidebar } from './Sidebar/Sidebar';
import { FlowEditor } from './Flowchart/FlowEditor';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectDataUpdate } from '../context/ProjectDataContext';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

interface AppContentProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  currentProject: ProjectData | null;
  setCurrentProject: (project: ProjectData | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

export const AppContent: React.FC<AppContentProps> = ({
  appState,
  setAppState,
  currentProject,
  setCurrentProject,
  isSidebarCollapsed,
  setIsSidebarCollapsed
}) => {
  const { refreshData } = useProjectDataUpdate();

  const handleOpenNewProjectModal = () => {
    setAppState('creatingProject');
  };

  const handleCreateProject = async (projectData: ProjectData) => {
    setCurrentProject(projectData);
    console.log('Nuovo progetto creato:', projectData);
    
    // Initialize project data with template
    await ProjectDataService.initializeProjectData(projectData.template, projectData.language);
    await refreshData();
    
    // Switch to main app
    setAppState('mainApp');
  };

  const handleCloseNewProjectModal = () => {
    if (currentProject) {
      setAppState('mainApp');
    } else {
      setAppState('landing');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Landing Page */}
      {(appState === 'landing' || appState === 'creatingProject') && (
        <LandingPage onStartClick={handleOpenNewProjectModal} />
      )}
      
      {/* Main App */}
      {appState === 'mainApp' && (
        <div className="min-h-screen bg-slate-900 flex flex-col">
          {/* Toolbar */}
          <Toolbar 
            onNewProject={handleOpenNewProjectModal}
            onOpenProject={() => console.log('Apri progetto')}
            onSave={() => console.log('Salva')}
            onRun={() => console.log('Esegui')}
            onSettings={() => console.log('Impostazioni')}
          />

          {/* Main Layout */}
          <div className="flex-1 flex h-[calc(100vh-64px)]">
            <Sidebar 
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <div className="flex-1">
              <FlowEditor />
            </div>
          </div>
        </div>
      )}
      
      {/* New Project Modal */}
      <NewProjectModal
        isOpen={appState === 'creatingProject'}
        onClose={handleCloseNewProjectModal}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};