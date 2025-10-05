import { ProjectDataService } from './ProjectDataService';
import { classifyActMode } from '../nlp/actInteractivity';

export interface EntityCreationConfig {
  entityType: 'agentActs' | 'backendActions' | 'tasks';
  defaultCategoryName: string;
  ddtEditorType: 'agentAct' | 'backendAction' | 'task';
  sidebarEventType: 'agentActs' | 'backendActions' | 'tasks';
}

export interface CreatedEntity {
  id: string;
  name: string;
  categoryType: string;
  actId: string;
  factoryId: string;
  mode?: string;
}

export interface EntityCreationOptions {
  name: string;
  onRowUpdate?: (item: CreatedEntity) => void;
  projectData: any;
  addCategory: (entityType: string, name: string) => Promise<void>;
  updateItem: (entityType: string, categoryId: string, itemId: string, updates: any) => Promise<void>;
}

const ENTITY_CONFIGS: Record<string, EntityCreationConfig> = {
  agentActs: {
    entityType: 'agentActs',
    defaultCategoryName: 'Default Agent Acts',
    ddtEditorType: 'agentAct',
    sidebarEventType: 'agentActs'
  },
  backendActions: {
    entityType: 'backendActions',
    defaultCategoryName: 'Default Backend Actions',
    ddtEditorType: 'backendAction',
    sidebarEventType: 'backendActions'
  },
  tasks: {
    entityType: 'tasks',
    defaultCategoryName: 'Default Tasks',
    ddtEditorType: 'task',
    sidebarEventType: 'tasks'
  }
};

export class EntityCreationService {
  /**
   * Crea un'entità (Agent Act, Backend Call, o Task) in modo centralizzato
   */
  static async createEntity(
    entityType: keyof typeof ENTITY_CONFIGS,
    options: EntityCreationOptions
  ): Promise<CreatedEntity | null> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    try {
      console.log(`🎯 Creating ${entityType} with name:`, options.name);

      // 1. Trova o crea la categoria
      const categoryId = await this.ensureCategoryExists(
        entityType,
        options.projectData,
        options.addCategory
      );

      if (!categoryId) {
        throw new Error(`Failed to create or find category for ${entityType}`);
      }

      // 2. Crea l'elemento
      const newItem = await ProjectDataService.addItem(
        config.entityType,
        categoryId,
        options.name,
        ''
      );

      // 3. Aggiorna l'elemento con metadati specifici (solo per agentActs)
      if (entityType === 'agentActs') {
        const mode = classifyActMode(options.name);
        await options.updateItem(config.entityType, categoryId, newItem.id, { mode });
      }

      // 4. Crea l'oggetto per la riga del nodo
      const rowItem: CreatedEntity = {
        id: newItem.id,
        name: options.name,
        categoryType: config.entityType,
        actId: newItem.id,
        factoryId: newItem.id,
        ...(entityType === 'agentActs' && { mode: classifyActMode(options.name) })
      };

      // 5. Aggiorna la riga del nodo se il callback è fornito
      if (options.onRowUpdate) {
        console.log('🎯 Updating node row with:', rowItem);
        options.onRowUpdate(rowItem);
      }

      // 6. Gestisci eventi UI
      await this.handleUIEvents(config, options.name);

      return rowItem;
    } catch (error) {
      console.error(`Error creating ${entityType}:`, error);
      return null;
    }
  }

  /**
   * Assicura che esista una categoria per il tipo di entità
   */
  private static async ensureCategoryExists(
    entityType: keyof typeof ENTITY_CONFIGS,
    projectData: any,
    addCategory: (entityType: string, name: string) => Promise<void>
  ): Promise<string | null> {
    const config = ENTITY_CONFIGS[entityType];
    const entities = (projectData as any)?.[config.entityType] || [];
    
    if (entities.length > 0) {
      return entities[0].id;
    }

    // Crea una categoria di default
    await addCategory(config.entityType, config.defaultCategoryName);
    const updatedData = await ProjectDataService.loadProjectData();
    const updatedEntities = (updatedData as any)?.[config.entityType] || [];
    
    return updatedEntities[0]?.id || null;
  }

  /**
   * Gestisce gli eventi UI (sidebar, DDT editor, etc.)
   */
  private static async handleUIEvents(config: EntityCreationConfig, name: string): Promise<void> {
    // Apri il pannello nel sidebar
    const sidebarEvent = new CustomEvent('sidebar:openAccordion', {
      detail: { entityType: config.sidebarEventType },
      bubbles: true
    });
    document.dispatchEvent(sidebarEvent);

    // Evidenzia l'elemento nel sidebar
    setTimeout(() => {
      const highlightEvent = new CustomEvent('sidebar:highlightItem', {
        detail: {
          entityType: config.sidebarEventType,
          itemName: name
        },
        bubbles: true
      });
      document.dispatchEvent(highlightEvent);
    }, 100);

    // Apri il DDT Editor
    setTimeout(() => {
      const variables = (window as any).__omniaVars || {};
      const ddtEvent = new CustomEvent('ddtEditor:open', {
        detail: {
          variables,
          name: name,
          type: config.ddtEditorType
        },
        bubbles: true
      });
      document.dispatchEvent(ddtEvent);
    }, 200);
  }

  /**
   * Factory method per creare Agent Act
   */
  static async createAgentAct(options: EntityCreationOptions): Promise<CreatedEntity | null> {
    return this.createEntity('agentActs', options);
  }

  /**
   * Factory method per creare Backend Call
   */
  static async createBackendCall(options: EntityCreationOptions): Promise<CreatedEntity | null> {
    return this.createEntity('backendActions', options);
  }

  /**
   * Factory method per creare Task
   */
  static async createTask(options: EntityCreationOptions): Promise<CreatedEntity | null> {
    return this.createEntity('tasks', options);
  }
}
