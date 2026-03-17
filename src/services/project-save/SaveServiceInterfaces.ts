// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task } from '../../types/taskTypes';
import type { ProjectData } from '../../types/project';

/**
 * Interface for TaskRepository service used in project save
 */
export interface ITaskRepository {
  /**
   * Save all tasks to database
   * @param projectId - Project ID
   * @param tasksToSave - Array of tasks to save (optional, uses all tasks if not provided)
   * @returns True if saved successfully
   */
  saveAllTasksToDatabase(projectId?: string, tasksToSave?: Task[]): Promise<boolean>;
}

/**
 * Interface for VariableCreationService used in project save
 */
export interface IVariableService {
  /**
   * Save all variables to database
   * @param projectId - Project ID
   * @returns True if saved successfully
   */
  saveToDatabase(projectId: string): Promise<boolean>;

  /**
   * Get all variables for a project
   * @param projectId - Project ID
   * @returns Array of variables
   */
  getAllVariables(projectId: string): any[];
}

/**
 * Interface for DialogueTaskService used in project save
 */
export interface IDialogueTaskService {
  /**
   * Save all grammarFlow from open editors to their templates
   */
  saveAllGrammarFlowFromStore(): Promise<void>;

  /**
   * Mark a template as modified (so it gets saved)
   * @param templateId - Template ID
   */
  markTemplateAsModified(templateId: string): void;

  /**
   * Save all modified templates to database
   * @param projectId - Project ID
   * @returns Result with saved/failed counts
   */
  saveModifiedTemplates(projectId: string): Promise<{
    saved: number;
    failed: number;
  }>;
}

/**
 * Interface for ProjectDataService used in project save
 */
export interface IProjectDataService {
  /**
   * Save project conditions to database
   * @param projectId - Project ID
   * @param projectData - Project data containing conditions
   */
  saveProjectConditionsToDb?(projectId: string, projectData: ProjectData): Promise<void>;
}

/**
 * Interface for TranslationsContext used in project save
 */
export interface ITranslationsContext {
  /**
   * Save all translations to database
   */
  saveAllTranslations(): Promise<void>;
}

/**
 * Interface for FlowState service used in project save
 */
export interface IFlowStateService {
  /**
   * Flush pending flow persist operations
   */
  flushFlowPersist(): Promise<void>;

  /**
   * Get flow by ID
   * @param id - Flow ID
   * @returns Flow object or null
   */
  getFlowById(id: string): any | null;

  /**
   * Get all nodes from current flow
   * @returns Array of nodes
   */
  getNodes(): any[];

  /**
   * Get all edges from current flow
   * @returns Array of edges
   */
  getEdges(): any[];

  /**
   * Transform ReactFlow nodes to simplified format
   * @param nodes - ReactFlow nodes
   * @returns Simplified nodes
   */
  transformNodesToSimplified(nodes: any[]): any[];

  /**
   * Transform ReactFlow edges to simplified format
   * @param edges - ReactFlow edges
   * @returns Simplified edges
   */
  transformEdgesToSimplified(edges: any[]): any[];
}
