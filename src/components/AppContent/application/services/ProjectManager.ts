// Application layer: Project Manager
// Handles project operations (create, open, delete, list)

import { ProjectService } from '@services/ProjectService';
import { ProjectDataService } from '@services/ProjectDataService';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { FlowStateBridge } from '@services/FlowStateBridge';
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

/** Prefix for draft project ids; project is only created in backend on first Save. */
export const DRAFT_PROJECT_ID_PREFIX = 'draft_';

export function isDraftProjectId(id: string | null | undefined): boolean {
  return Boolean(id && String(id).startsWith(DRAFT_PROJECT_ID_PREFIX));
}

export class ProjectManager {
  constructor(private params: ProjectManagerParams) {}

  /**
   * Opens a new project as draft (no backend creation). Project is created on first Save.
   */
  async createDraftProject(projectInfo: ProjectInfo): Promise<CreateProjectResult> {
    try {
      const draftId = `${DRAFT_PROJECT_ID_PREFIX}${Date.now()}`;
      const draftProject: ProjectData & ProjectInfo = {
        ...projectInfo,
        id: draftId,
        name: projectInfo.name || 'Project',
        industry: projectInfo.industry || 'utility_gas',
        ownerCompany: (projectInfo.ownerCompany || '').trim() || null,
        ownerClient: (projectInfo.ownerClient || '').trim() || null,
        clientName: (projectInfo.clientName || '').trim() || undefined,
        taskTemplates: [],
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: [],
      };
      this.params.setCurrentProject(draftProject);
      this.params.pdUpdate.setCurrentProjectId(null);
      try {
        localStorage.removeItem('currentProjectId');
      } catch { }
      FlowStateBridge.clear();
      await this.params.refreshData();
      this.params.setAppState('mainApp');
      return { success: true, error: null };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('[ProjectManager] createDraftProject failed:', e);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Creates the project in the backend (bootstrap) and replaces draft with real project. Returns the new projectId.
   */
  async commitDraftProject(draftProject: ProjectData & ProjectInfo): Promise<string> {
    const clientName = (draftProject.clientName || '').trim() || null;
    const ownerCompany = (draftProject.ownerCompany || '').trim() || null;
    const ownerClient = (draftProject.ownerClient || '').trim() || null;
    const resp = await fetch('/api/projects/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName,
        projectName: draftProject.name || 'Project',
        industry: draftProject.industry || 'utility_gas',
        language: draftProject.language || 'pt',
        ownerCompany,
        ownerClient,
        version: draftProject.version || '1.0',
        versionQualifier: draftProject.versionQualifier || 'alpha',
        tenantId: 'tenant_default',
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || err.message || resp.statusText || 'Bootstrap failed');
    }
    const boot = await resp.json();
    const projectId = boot.projectId;
    this.params.pdUpdate.setCurrentProjectId(projectId);
    try {
      localStorage.setItem('currentProjectId', projectId);
    } catch { }
    const updatedProject: ProjectData & ProjectInfo = {
      ...draftProject,
      id: projectId,
    };
    this.params.setCurrentProject(updatedProject);
    return projectId;
  }

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
      // ✅ FIX: Trim clientName and convert empty string to null
      const clientName = (projectInfo.clientName || '').trim() || null;
      const ownerCompany = (projectInfo.ownerCompany || '').trim() || null;
      const ownerClient = (projectInfo.ownerClient || '').trim() || null;

      const resp = await fetch('/api/projects/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          projectName: projectInfo.name || 'Project',
          industry: projectInfo.industry || 'utility_gas',
          language: projectInfo.language || 'pt',
          ownerCompany,
          ownerClient,
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
        localStorage.setItem('currentProjectId', projectId);
      } catch { }
      this.params.pdUpdate.setCurrentProjectId(projectId);
      FlowStateBridge.clear();

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
      const normId = (v: any) => v == null ? '' : (typeof v === 'string' ? v : (v && (v as any).$oid ? (v as any).$oid : (v && typeof (v as any).toString === 'function' ? (v as any).toString() : String(v))));
      const meta = (list || []).find((x: any) => normId(x._id) === normId(id) || normId(x.projectId) === normId(id)) || {};
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] ✅ END fetch catalog`, {
          duration: `${(performance.now() - catStart).toFixed(2)}ms`,
          found: !!meta,
        });
      }

      this.params.pdUpdate.setCurrentProjectId(id);
      try {
        localStorage.setItem('currentProjectId', id);
      } catch { }

      // ✅ CRITICAL: Load tasks FIRST and wait for completion
      // Tasks MUST be loaded before flowchart is rendered to prevent TaskTreeOpener from finding empty repository
      const tasksLoadStart = performance.now();
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] 🔄 START loadAllTasksFromDatabase`);
      }

      let tasksLoaded = false;
      try {
        tasksLoaded = await taskRepository.loadAllTasksFromDatabase(id);
      } catch (e) {
        console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllTasksFromDatabase`, {
          projectId: id,
          error: String(e),
        });
        throw new Error(`Failed to load tasks: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (!tasksLoaded) {
        throw new Error('Failed to load tasks from database');
      }

      // ✅ CRITICAL: Verify repository is populated
      const tasksCount = taskRepository.getAllTasks().length;
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] ✅ END loadAllTasksFromDatabase`, {
          duration: `${(performance.now() - tasksLoadStart).toFixed(2)}ms`,
          tasksCount,
        });
      }

      // ✅ CRITICAL: Repository must be populated before proceeding
      // This ensures TaskTreeOpener will always find tasks when gear icon is clicked
      console.log('[ProjectManager] ✅ Tasks loaded and verified', {
        projectId: id,
        tasksCount,
        repositoryReady: true,
      });

      // ✅ Register project-local templates into DialogueTaskService cache so that
      // TaskTreeOpener can resolve templateId references even for non-Factory templates.
      // Local templates are tasks with templateId === null stored in the project DB.
      try {
        const DialogueTaskServiceModule = await import('@services/DialogueTaskService');
        const DialogueTaskService = DialogueTaskServiceModule.default;
        const projectTemplates = taskRepository.getAllTasks().filter(
          t => (t as any).templateId === null || (t as any).templateId === undefined
        );
        if (projectTemplates.length > 0) {
          DialogueTaskService.registerExternalTemplates(projectTemplates as any[]);
          console.log('[ProjectManager] ✅ Project templates registered in DialogueTaskService', {
            projectId: id,
            count: projectTemplates.length,
            templateIds: projectTemplates.map(t => t.id)
          });
        }
      } catch (e) {
        console.warn('[ProjectManager] ⚠️ Failed to register project templates in DialogueTaskService', e);
      }

      // ✅ NEW: Load project embeddings in background (non-blocking)
      // This ensures embeddings from project database are available for template matching
      try {
        const { EmbeddingService } = await import('@services/EmbeddingService');
        EmbeddingService.loadEmbeddings('task', false, id).catch(err => {
          console.warn('[ProjectManager] ⚠️ Failed to load project embeddings (non-blocking):', err);
        });
        if (showPerfLogs) {
          console.log(`[PERF][${new Date().toISOString()}] 🔄 START load project embeddings (background)`);
        }
      } catch (e) {
        console.warn('[ProjectManager] ⚠️ Failed to start loading project embeddings:', e);
      }

      // Variable rows (project store). Canvas loads FlowDocument via loadFlow / FlowWorkspace (atomic).
      const mappingsStart = performance.now();
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] 🔄 START load variable mappings`);
      }
      try {
        await variableCreationService.loadFromDatabase(id);
      } catch (e) {
        console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR load variable mappings`, e);
      }
      if (showPerfLogs) {
        console.log(`[PERF][${new Date().toISOString()}] ✅ END load variable mappings`, {
          duration: `${(performance.now() - mappingsStart).toFixed(2)}ms`,
        });
      }

      // ✅ Fonte primaria: project_meta (DB del progetto). Fallback: catalogo (per clientName/version se meta non li ha).
      let resolvedMeta = { ...meta };
      try {
        const metaRes = await fetch(`/api/projects/${encodeURIComponent(id)}/meta`);
        if (metaRes.ok) {
          const projectMeta = await metaRes.json();
          resolvedMeta = { ...resolvedMeta, ...projectMeta };
          // Non sovrascrivere con null: se project_meta non ha clientName (progetto vecchio), tiene il valore dal catalogo
          if ((resolvedMeta.clientName == null || String(resolvedMeta.clientName).trim() === '') && (meta.clientName != null && String(meta.clientName).trim() !== '')) {
            resolvedMeta.clientName = meta.clientName;
          }
          if ((resolvedMeta.projectName == null || String(resolvedMeta.projectName).trim() === '') && (meta.projectName != null && String(meta.projectName).trim() !== '')) {
            resolvedMeta.projectName = meta.projectName;
          }
          if ((resolvedMeta.version == null || String(resolvedMeta.version).trim() === '') && (meta.version != null && String(meta.version).trim() !== '')) {
            resolvedMeta.version = meta.version;
          }
        }
      } catch {
        // Usa solo il catalogo
      }

      // Load project data and set currentProject
      const data = await ProjectDataService.loadProjectData();

      // Initialize UI state: clientName e campi progetto da project_meta (o catalogo se /meta fallisce)
      const openedProject: ProjectData & ProjectInfo = {
        id: id,
        name: resolvedMeta.projectName || resolvedMeta.name || '',
        description: resolvedMeta.description || '',
        template: resolvedMeta.template || '',
        language: resolvedMeta.language || 'pt',
        clientName: resolvedMeta.clientName ?? null,
        industry: resolvedMeta.industry || 'utility_gas',
        ownerCompany: resolvedMeta.ownerCompany ?? null,
        ownerClient: resolvedMeta.ownerClient ?? null,
        version: resolvedMeta.version || '1.0',
        versionQualifier: resolvedMeta.versionQualifier || 'production',
        taskTemplates: data.taskTemplates,
        userActs: data.userActs,
        backendActions: data.backendActions,
        conditions: data.conditions,
        tasks: [],
        macrotasks: data.macrotasks,
        backendCatalog: data.backendCatalog,
      };

      this.params.setCurrentProject(openedProject);

      // ✅ CRITICAL: Verify repository is still populated before allowing UI to render
      const finalTasksCount = taskRepository.getAllTasks().length;
      if (finalTasksCount === 0) {
        console.warn('[ProjectManager] ⚠️ Repository is empty after all operations - this should not happen');
      }

      // Refresh data and set app state
      // ✅ CRITICAL: Only set app state AFTER tasks are loaded and verified
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
