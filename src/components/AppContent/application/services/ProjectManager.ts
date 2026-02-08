// Application layer: Project Manager
// Handles project operations (create, open, delete, list)

import { ProjectService } from '@services/ProjectService';
import { ProjectDataService } from '@services/ProjectDataService';
import { taskRepository } from '@services/TaskRepository';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';
import type { ProjectInfo, ProjectData } from '@types/projectTypes';

export interface ProjectManagerParams {
  pdUpdate: any;
  setCurrentProject: (project: ProjectData & ProjectInfo) => void;
  refreshData: () => Promise<void>;
  setAppState: (state: string) => void;
}

export interface ProjectListResult {
  projects: any[];
  error: string | null;
}

export interface CreateProjectResult {
  success: boolean;
  error: string | null;
}

export class ProjectManager {
  constructor(private params: ProjectManagerParams) {}

  /**
   * Fetches recent projects (last 10)
   */
  async fetchRecentProjects(): Promise<ProjectListResult> {
    try {
      const projects = await ProjectService.getRecentProjects();
      return { projects, error: null };
    } catch (e) {
      console.error('[ProjectManager] Error loading recent projects:', e);
      const errorMsg = e instanceof Error
        ? (e.message.includes('fetch') || e.message.includes('network')
          ? 'Backend non raggiungibile. Assicurati che il server sia avviato.'
          : e.message)
        : 'Errore nel caricamento progetti';
      return { projects: [], error: errorMsg };
    }
  }

  /**
   * Fetches all projects
   */
  async fetchAllProjects(): Promise<ProjectListResult> {
    try {
      const projects = await ProjectService.getAllProjects();
      return { projects, error: null };
    } catch (e) {
      console.error('[ProjectManager] Error loading all projects:', e);
      const errorMsg = e instanceof Error
        ? (e.message.includes('fetch') || e.message.includes('network')
          ? 'Backend non raggiungibile. Assicurati che il server sia avviato.'
          : e.message)
        : 'Errore nel caricamento progetti';
      return { projects: [], error: errorMsg };
    }
  }

  /**
   * Creates a new project
   */
  async createProject(projectInfo: ProjectInfo): Promise<CreateProjectResult> {
    try {
      // Bootstrap: create DB and catalog immediately
      const resp = await fetch('/api/projects/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: projectInfo.clientName || null,
          projectName: projectInfo.name || 'Project',
          industry: projectInfo.industry || 'utility_gas',
          language: projectInfo.language || 'pt',
          ownerCompany: projectInfo.ownerCompany || null,
          ownerClient: projectInfo.ownerClient || null,
          version: projectInfo.version || '1.0',
          versionQualifier: projectInfo.versionQualifier || 'alpha',
          tenantId: 'tenant_default',
        }),
      });

      if (!resp.ok) {
        let errorMessage = 'bootstrap_failed';
        try {
          const errorData = await resp.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, try to get status text
          errorMessage = resp.statusText || `Server error (${resp.status})`;
        }
        console.error('[ProjectManager] Bootstrap failed:', {
          status: resp.status,
          statusText: resp.statusText,
          errorMessage,
        });
        throw new Error(errorMessage);
      }

      const boot = await resp.json();
      const projectId = boot.projectId;

      // Load project data
      const data = await ProjectDataService.loadProjectData();

      // Initialize UI state
      const newProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        id: projectId,
        industry: projectInfo.industry || 'utility_gas',
        ownerCompany: projectInfo.ownerCompany || null,
        ownerClient: projectInfo.ownerClient || null,
        taskTemplates: data.taskTemplates,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [], // Deprecated: tasks migrated to macrotasks
        macrotasks: data.macrotasks,
      };

      this.params.setCurrentProject(newProject);
      try {
        localStorage.setItem('project.lang', String(projectInfo.language || 'pt'));
      } catch { }
      try {
        localStorage.setItem('current.projectId', projectId);
      } catch { }
      this.params.pdUpdate.setCurrentProjectId(projectId);
      try {
        (window as any).__flowNodes = [];
        (window as any).__flowEdges = [];
      } catch { }

      await this.params.refreshData();
      this.params.setAppState('mainApp');

      return { success: true, error: null };
    } catch (e) {
      let errorMessage = 'Errore nella creazione del progetto';
      if (e instanceof Error) {
        errorMessage = e.message || errorMessage;
        if (errorMessage === 'bootstrap_failed') {
          errorMessage = 'Errore nella creazione del progetto. Verifica i log del server per dettagli.';
        }
      }
      console.error('[ProjectManager] Error creating project:', e);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Opens a project by ID
   */
  async openProjectById(id: string): Promise<{ success: boolean; error?: string }> {
    if (!id) {
      return { success: false, error: 'Project ID is required' };
    }

    const showPerfLogs = import.meta.env.DEV && localStorage.getItem('SHOW_PERF_LOGS') === 'true';
    if (showPerfLogs) {
      console.log(`[PERF][${new Date().toISOString()}] 🚀 START openProjectById`, { projectId: id });
    }

    try {
      // Fetch catalog
      const catStart = performance.now();
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] 📋 START fetch catalog`);
      }
      const catRes = await fetch('/api/projects/catalog');
      if (!catRes.ok) {
        throw new Error('Errore nel recupero catalogo');
      }
      const list = await catRes.json();
      const meta = (list || []).find((x: any) => x._id === id || x.projectId === id) || {};
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] ✅ END fetch catalog`, {
          duration: `${(performance.now() - catStart).toFixed(2)}ms`,
          found: !!meta,
        });
      }

      this.params.pdUpdate.setCurrentProjectId(id);
      try {
        localStorage.setItem('current.projectId', id);
      } catch { }

      // Load tasks, flow, and variable mappings in parallel
      const parallelStart = performance.now();
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] 🔄 START parallel load (tasks, flow, mappings)`);
      }

      const [tasksResult, flowResult, mappingsResult] = await Promise.allSettled([
        (async () => {
          try {
            return await taskRepository.loadAllTasksFromDatabase(id);
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
              projectId: id,
              error: String(e),
            });
            return false;
          }
        })(),
        (async () => {
          try {
            const flowRes = await fetch(`/api/projects/${encodeURIComponent(id)}/flow`);
            if (flowRes.ok) {
              const flow = await flowRes.json();
              console.log(`[LOAD][ProjectManager] 📥 Flow received from backend`, {
                projectId: id,
                nodesCount: flow.nodes?.length || 0,
                edgesCount: flow.edges?.length || 0,
              });
              return {
                nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
                edges: Array.isArray(flow.edges) ? flow.edges : [],
              };
            }
            return { nodes: [], edges: [] };
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load flow`, e);
            return { nodes: [], edges: [] };
          }
        })(),
        (async () => {
          try {
            await flowchartVariablesService.init(id);
            return true;
          } catch (e) {
            console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load variable mappings`, e);
            return false;
          }
        })(),
      ]);

      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] ✅ END parallel load`, {
          duration: `${(performance.now() - parallelStart).toFixed(2)}ms`,
        });
      }

      // Refresh data and set app state
      await this.params.refreshData();
      this.params.setAppState('mainApp');

      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] 🎉 COMPLETE openProjectById`, {
          duration: `${(performance.now() - performance.now()).toFixed(2)}ms`,
        });
      }

      return { success: true };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Errore nell\'apertura del progetto';
      console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR openProjectById`, {
        projectId: id,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Deletes a project
   */
  async deleteProject(id: string): Promise<void> {
    await ProjectService.deleteProject(id);
  }

  /**
   * Deletes all projects
   */
  async deleteAllProjects(): Promise<void> {
    await ProjectService.deleteAllProjects();
  }
}
