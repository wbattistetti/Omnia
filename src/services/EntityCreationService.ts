import { ProjectDataService } from './ProjectDataService';
import { classifyActMode } from '../nlp/actInteractivity';
import { modeToType, typeToMode } from '../utils/normalizers';
import { classifyScopeFromLabel, Scope, Industry } from './ScopeClassificationService';

export interface EntityCreationConfig {
  entityType: 'agentActs' | 'backendActions' | 'tasks' | 'conditions';
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
  projectIndustry?: Industry;
  scope?: 'global' | 'industry';
  categoryName?: string; // Nome della categoria (opzionale, default: "Categorize Later")
  // New explicit typing to avoid window flags
  type?: string; // ActType
  mode?: string; // mapped from type
  suppressUI?: boolean;
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
  ,
  conditions: {
    entityType: 'conditions',
    defaultCategoryName: 'Default Conditions',
    ddtEditorType: 'task',
    sidebarEventType: 'conditions'
  }
};

export class EntityCreationService {
  /**
   * Crea un'entità (Agent Act, Backend Call, o Task) SOLO IN MEMORIA
   * Il salvataggio nel DB factory avviene in modo esplicito
   */
  static createEntity(
    entityType: keyof typeof ENTITY_CONFIGS,
    options: EntityCreationOptions
  ): CreatedEntity | null {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    try { console.log('[CreateFlow] service.enter', { entityType, name: options.name, scope: options.scope, categoryName: options.categoryName, hasOnRowUpdate: !!options.onRowUpdate }); } catch {}

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

    // 2. Trova o crea la categoria nel progetto locale (ISTANTANEO)
    const categoryId = this.ensureCategoryExistsSync(
      entityType,
      options.projectData,
      options.categoryName
    );

    if (!categoryId) {
      console.error(`Failed to create or find category for ${entityType}`);
      return null;
    }

    // 3. Crea l'elemento nel progetto locale (ISTANTANEO)
    const newItem = this.createItemSync(
      config.entityType,
      categoryId,
      options.name,
      finalScope,
      finalIndustry,
      entityType,
      options.projectData
    );

    // 4. Aggiorna l'elemento con metadati specifici (ISTANTANEO)
    this.updateItemSync(
      config.entityType,
      categoryId,
      newItem.id,
      {
        scope: finalScope,
        industry: finalIndustry,
        status: 'draft',
        version: '1.0.0',
        isInMemory: true,
        factoryId: null,
        ...(entityType === 'agentActs' && (() => {
          const providedType = (options as any)?.type as any;
          const providedMode = (options as any)?.mode as any;
          const inferredMode = providedMode || classifyActMode(options.name);
          const finalType = providedType || modeToType(inferredMode);
          const finalMode = providedMode || typeToMode(finalType as any);
          return {
            type: finalType,
            mode: finalMode,
            ddtId: undefined,
            testPassed: false,
            __suppressEditorOnce: Boolean((options as any)?.suppressUI)
          };
        })())
      },
      options.projectData
    );

    // 5. Crea l'oggetto per la riga del nodo
    const rowItem: CreatedEntity = {
      id: newItem.id,
      name: options.name,
      categoryType: config.entityType,
      actId: newItem.id,
      factoryId: null, // Nessun ID factory ancora
      ...(entityType === 'agentActs' && (() => {
        const t = (newItem as any)?.type as any;
        const m = (newItem as any)?.mode as any;
        const finalType = t || modeToType(m) || 'Message';
        const finalMode = typeToMode(finalType);
        return { type: finalType, mode: finalMode, ddtId: undefined, testPassed: false };
      })())
    };

    // 6. Aggiorna la riga del nodo se il callback è fornito
    if (options.onRowUpdate) {
      try { console.log('[CreateFlow] service.rowUpdateCallback', { id: rowItem.id, type: (rowItem as any)?.type, mode: (rowItem as any)?.mode }); } catch {}
      options.onRowUpdate(rowItem);
    }

    // 7. Gestisci eventi UI (asincrono ma non blocca)
    // Se è stato richiesto di non aprire gli editor, salta apertura
    const suppress = (newItem as any)?.__suppressEditorOnce;
    if (!suppress && !options?.suppressUI && config.entityType !== 'conditions') {
      this.handleUIEvents(config, options.name).catch(console.error);
    }

    // 8. Notifica il sidebar dell'aggiornamento
    setTimeout(() => {
      try {
        // Lazy import to avoid circular deps during SSR
        import('../ui/events').then(m => { m.emitSidebarRefresh(); m.emitSidebarForceRender(); }).catch(() => {});
      } catch {}
    }, 50);

    return rowItem;
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
   * Assicura che esista una categoria per il tipo di entità (SINCRONO)
   */
  private static ensureCategoryExistsSync(
    entityType: keyof typeof ENTITY_CONFIGS,
    projectData: any,
    categoryName?: string
  ): string | null {
    const config = ENTITY_CONFIGS[entityType];
    const entities = (projectData as any)?.[config.entityType] || [];
    
    // Se è specificata una categoria, cerca quella
    if (categoryName) {
      const existingCategory = entities.find((cat: any) => cat.name === categoryName);
      if (existingCategory) {
        return existingCategory.id;
      }
      
      // Crea la nuova categoria
      const newCategoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newCategory = {
        id: newCategoryId,
        name: categoryName,
        items: []
      };
      
      // Inserisci la categoria in ordine alfabetico
      const norm = (s: string) => (s || '').toLocaleLowerCase();
      let inserted = false;
      for (let i = 0; i < entities.length; i++) {
        const curr = String(entities[i]?.name || '');
        if (norm(categoryName).localeCompare(norm(curr)) < 0) {
          entities.splice(i, 0, newCategory);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        entities.push(newCategory);
      }
      
      return newCategoryId;
    }
    
    // Se non è specificata una categoria, usa la prima disponibile o crea "Categorize Later"
    if (entities.length > 0) {
      return entities[0].id;
    }

    // Crea una categoria "Categorize Later" sincronamente
    const newCategoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCategory = {
      id: newCategoryId,
      name: 'Categorize Later',
      items: []
    };
    
    // Aggiungi la categoria al progetto locale
    (projectData as any)[config.entityType] = [newCategory];
    
    return newCategoryId;
  }

  /**
   * Crea un elemento sincronamente e lo aggiunge al projectData
   */
  private static createItemSync(
    entityType: string,
    categoryId: string,
    name: string,
    scope: Scope,
    industry: Industry | undefined,
    originalEntityType: string,
    projectData: any
  ): any {
    const inferredMode = classifyActMode(name);
    const finalType = originalEntityType === 'agentActs' ? modeToType(inferredMode) : undefined;
    const finalMode = originalEntityType === 'agentActs' ? typeToMode((finalType as any) || 'Message') : undefined;
    const newItemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem = {
      id: newItemId,
      name,
      description: '',
      scope,
      industry,
      status: 'draft',
      version: '1.0.0',
      isInMemory: true,
      factoryId: null,
      ...(originalEntityType === 'agentActs' && { type: finalType, mode: finalMode, ddtId: undefined, testPassed: false })
    };

    // Aggiungi l'elemento alla categoria nel projectData
    const entities = (projectData as any)?.[entityType] || [];
    const category = entities.find((c: any) => c.id === categoryId);
    if (category && category.items) {
      // Inserisci alfabeticamente
      const items = category.items as any[];
      const norm = (s: string) => (s || '').toLocaleLowerCase();
      let inserted = false;
      for (let i = 0; i < items.length; i++) {
        const curr = String(items[i]?.name || items[i]?.label || '');
        if (norm(name).localeCompare(norm(curr)) < 0) {
          items.splice(i, 0, newItem);
          inserted = true;
          break;
        }
      }
      if (!inserted) items.push(newItem);
    }

    return newItem;
  }

  /**
   * Aggiorna un elemento sincronamente
   */
  private static updateItemSync(
    entityType: string,
    categoryId: string,
    itemId: string,
    updates: any,
    projectData: any
  ): void {
    // Applica gli aggiornamenti all'elemento nel projectData
    try {
      // Aggiorna direttamente l'oggetto presente su projectData passato
      const entities = (projectData as any)?.[entityType] || [];
      let itemRef: any = null;
      for (const cat of entities) {
        if (cat.id !== categoryId) continue;
        const it = (cat.items || []).find((i: any) => i.id === itemId);
        if (it) { itemRef = it; break; }
      }
      if (itemRef) {
        const safeUpdates = { ...updates } as any;
        if (typeof safeUpdates.type === 'undefined') delete safeUpdates.type;
        if (typeof safeUpdates.mode === 'undefined') delete safeUpdates.mode;
        Object.assign(itemRef, safeUpdates);
      } else {
        // No direct reference found; the returned newItem already has updated fields
      }
    } catch {}
  }

  /**
   * Assicura che esista una categoria per il tipo di entità (ASINCRONO - DEPRECATO)
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
    try { (await import('../ui/events')).emitSidebarOpenAccordion(config.sidebarEventType); } catch {}

    // Evidenzia l'elemento nel sidebar
    setTimeout(async () => {
      try { (await import('../ui/events')).emitSidebarHighlightItem(config.sidebarEventType, name); } catch {}
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
  static createAgentAct(options: EntityCreationOptions): CreatedEntity | null {
    return this.createEntity('agentActs', options);
  }

  /**
   * Factory method per creare Backend Call
   */
  static createBackendCall(options: EntityCreationOptions): CreatedEntity | null {
    return this.createEntity('backendActions', options);
  }

  /**
   * Factory method per creare Task
   */
  static createTask(options: EntityCreationOptions): CreatedEntity | null {
    return this.createEntity('tasks', options);
  }

  /**
   * Factory method per creare Condition
   */
  static createCondition(options: EntityCreationOptions): CreatedEntity | null {
    return this.createEntity('conditions', options);
  }

  /**
   * Salva un'entità in memoria nel DB factory
   */
  static async saveEntityToFactory(
    entityType: keyof typeof ENTITY_CONFIGS,
    itemId: string,
    projectData: any
  ): Promise<boolean> {
    const config = ENTITY_CONFIGS[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    try {
      // Trova l'elemento nel progetto locale
      const entities = (projectData as any)?.[config.entityType] || [];
      const item = entities.find((e: any) => e.id === itemId);
      
      if (!item) {
        throw new Error(`Item ${itemId} not found in project data`);
      }

      if (!item.isInMemory) {
        console.log(`Item ${itemId} is already saved to factory`);
        return true;
      }

      // Crea l'elemento nel DB factory
      const factoryItem = await this.createFactoryItem(
        entityType,
        item.name,
        { scope: item.scope, industry: item.industry, confidence: 1.0 },
        item.industry
      );

      if (!factoryItem) {
        throw new Error(`Failed to create factory item for ${entityType}`);
      }

      // Aggiorna l'elemento locale con l'ID factory
      const updates = {
        factoryId: factoryItem._id,
        status: 'published',
        isInMemory: false
      };

      // Qui dovresti chiamare il metodo per aggiornare l'elemento nel progetto locale
      // await options.updateItem(config.entityType, categoryId, itemId, updates);

      console.log(`✅ Saved ${entityType} ${itemId} to factory with ID: ${factoryItem._id}`);
      return true;
    } catch (error) {
      console.error(`Error saving ${entityType} to factory:`, error);
      return false;
    }
  }
}
