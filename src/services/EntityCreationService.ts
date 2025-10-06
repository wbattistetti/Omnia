import { ProjectDataService } from './ProjectDataService';
import { classifyActMode } from '../nlp/actInteractivity';
import { classifyScopeFromLabel, Scope, Industry } from './ScopeClassificationService';

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
  ddtId?: string | undefined;
  testPassed?: boolean;
}

export interface EntityCreationOptions {
  name: string;
  onRowUpdate?: (item: CreatedEntity) => void;
  projectData: any;
  addCategory: (entityType: string, name: string) => Promise<void>;
  updateItem: (entityType: string, categoryId: string, itemId: string, updates: any) => Promise<void>;
  projectIndustry?: Industry;
  scope?: 'global' | 'industry';
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

      // 1. Determina lo scope (utente o automatico)
      let finalScope: Scope;
      let finalIndustry: Industry | undefined;
      
      if (options.scope) {
        // Scope fornito dall'utente
        finalScope = options.scope;
        finalIndustry = options.scope === 'industry' ? (options.projectIndustry || 'utility-gas') : undefined;
        console.log(`🎯 User-specified scope:`, { scope: finalScope, industry: finalIndustry });
      } else {
        // Classificazione automatica
        const scopeGuess = classifyScopeFromLabel(options.name, options.projectIndustry);
        finalScope = scopeGuess.scope;
        finalIndustry = scopeGuess.industry;
        console.log(`🎯 Auto-classified scope:`, scopeGuess);
      }

      // 2. Salva nella collezione specifica
      const factoryItem = await this.createFactoryItem(
        entityType,
        options.name,
        { scope: finalScope, industry: finalIndustry, confidence: 1.0 },
        options.projectIndustry
      );

      if (!factoryItem) {
        throw new Error(`Failed to create factory item for ${entityType}`);
      }

      // 3. Trova o crea la categoria nel progetto locale
      const categoryId = await this.ensureCategoryExists(
        entityType,
        options.projectData,
        options.addCategory
      );

      if (!categoryId) {
        throw new Error(`Failed to create or find category for ${entityType}`);
      }

      // 4. Crea l'elemento nel progetto locale
      const newItem = await ProjectDataService.addItem(
        config.entityType,
        categoryId,
        options.name,
        ''
      );

      // 5. Aggiorna l'elemento con metadati specifici
      const updates: any = {
        factoryId: factoryItem._id,
        scope: finalScope,
        industry: finalIndustry,
        status: 'published',
        version: '1.0.0'
      };

      if (entityType === 'agentActs') {
        updates.mode = classifyActMode(options.name);
      }

      await options.updateItem(config.entityType, categoryId, newItem.id, updates);

      // 6. Crea l'oggetto per la riga del nodo
      const rowItem: CreatedEntity = {
        id: newItem.id,
        name: options.name,
        categoryType: config.entityType,
        actId: newItem.id,
        factoryId: factoryItem._id,
        ...(entityType === 'agentActs' && { 
          mode: classifyActMode(options.name),
          ddtId: undefined, // Nessun DDT associato inizialmente
          testPassed: false // Test non ancora passato
        })
      };

      // 7. Aggiorna la riga del nodo se il callback è fornito
      if (options.onRowUpdate) {
        console.log('🎯 Updating node row with:', rowItem);
        options.onRowUpdate(rowItem);
      }

      // 8. Gestisci eventi UI
      await this.handleUIEvents(config, options.name);

      return rowItem;
    } catch (error) {
      console.error(`Error creating ${entityType}:`, error);
      return null;
    }
  }

  /**
   * Crea un elemento nella collezione factory specifica
   */
  private static async createFactoryItem(
    entityType: keyof typeof ENTITY_CONFIGS,
    name: string,
    scopeGuess: { scope: Scope; industry?: Industry; confidence: number },
    projectIndustry?: Industry
  ): Promise<any> {
    const config = ENTITY_CONFIGS[entityType];
    
    // Mappa i tipi di entità agli endpoint
    const endpointMap: { [key: string]: string } = {
      'agentActs': '/api/factory/agent-acts',
      'backendActions': '/api/factory/backend-calls',
      'tasks': '/api/factory/tasks'
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) {
      throw new Error(`Unknown endpoint for entity: ${entityType}`);
    }

    // Determina scope e industry finali
    const finalScope = scopeGuess.scope;
    const finalIndustry = scopeGuess.scope === 'industry' 
      ? (scopeGuess.industry || projectIndustry || 'utility-gas')
      : undefined;

    const factoryItem = {
      label: name,
      name: name,
      description: '',
      scope: finalScope,
      ...(finalIndustry && { industry: finalIndustry }),
      status: 'published',
      version: '1.0.0',
      category: 'Default',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(entityType === 'agentActs' && { 
        mode: classifyActMode(name),
        data: {},
        prompts: {},
        ddtId: undefined, // Nessun DDT associato inizialmente
        testPassed: false // Test non ancora passato
      })
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factoryItem)
      });

      if (!response.ok) {
        throw new Error(`Failed to create factory item: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating factory item:', error);
      throw error;
    }
  }

  /**
   * Genera una chiave univoca per l'elemento del catalog
   */
  private static generateKey(name: string, type: string): string {
    const cleanName = name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();
    
    const timestamp = Date.now().toString().slice(-6);
    return `${type.toUpperCase()}_${cleanName}_${timestamp}`;
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
