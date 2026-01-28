import type { TaskCatalog } from '../types/taskTypes';

/**
 * Service for managing TaskCatalog entries
 * Converts Action Catalog entries to TaskCatalog format
 *
 * This service is added alongside existing Action Catalog usage
 * for gradual migration - existing code continues to work
 */
class TaskTemplateService {
  private templates: Map<string, TaskCatalog> = new Map();
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize templates from Action Catalog
   * Called lazily on first access
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.loadTemplates();
    await this.initializationPromise;
  }

  /**
   * Load templates from Factory database
   */
  private async loadTemplates(): Promise<void> {
    try {
      // Try to load from Factory first
      const factoryResponse = await fetch('/api/factory/tasks');
      if (factoryResponse.ok) {
        const factoryTemplates = await factoryResponse.json();
        if (Array.isArray(factoryTemplates) && factoryTemplates.length > 0) {
          factoryTemplates.forEach((template: any) => {
            // Map database document to TaskCatalog
            const templateId = template.id || template._id;
            const mapped: TaskCatalog = {
              id: templateId,
              label: template.label || '',
              description: template.description || '',
              icon: template.icon || 'Circle',
              color: template.color || 'text-gray-500',
              signature: template.signature,
              valueSchema: template.valueSchema,
              scope: template.scope,
              industry: template.industry,
              createdAt: template.createdAt ? new Date(template.createdAt) : undefined,
              updatedAt: template.updatedAt ? new Date(template.updatedAt) : undefined
            };
            // Store the full template object (including nlpContract) for access
            (mapped as any).nlpContract = template.nlpContract;
            // Store also the original _id and name for lookup
            (mapped as any)._id = template._id;
            (mapped as any).name = template.name;

            // Save with UUID as key (for compatibility)
            this.templates.set(templateId, mapped);

            // ✅ Also save with 'name' as key (canonical, language-independent) for lookup
            if (template.name) {
              const nameKey = template.name.toLowerCase();
              this.templates.set(nameKey, mapped);

            }
          });

          // Log only in development mode
          if (import.meta.env.DEV) {
            // ❌ RIMOSSO: log verboso di caricamento (non necessario all'avvio)
            // console.log(`✅ [TaskTemplateService] Caricati ${this.templates.size} template dal database`, {
            //   templateIds: Array.from(this.templates.keys()),
            //   contractsCount: Array.from(this.templates.values()).filter(t => (t as any).nlpContract).length
            // });
          }

          this.initialized = true;
          return;
        }
      }

      // Fallback: Load from Action Catalog JSON file (legacy)
      console.warn('[TaskTemplateService] Factory templates empty, falling back to actionsCatalog.json');
      const response = await fetch('/data/actionsCatalog.json');
      if (!response.ok) {
        console.warn('[TaskTemplateService] Failed to load actionsCatalog.json');
        this.addActTypeTemplates(); // At least add ActType templates
        this.initialized = true;
        return;
      }

      const actionsCatalog = await response.json();

      // Convert Action Catalog entries to TaskCatalog entries
      (actionsCatalog as any[]).forEach((action: any) => {
        const template = this.convertActionToTemplate(action);
        this.templates.set(template.id, template);
      });

      // Add templates for ActType mappings (Message, DataRequest, etc.)
      this.addActTypeTemplates();

      this.initialized = true;
    } catch (error) {
      console.error('[TaskTemplateService] Error loading templates:', error);
      // Add ActType templates even if loading fails
      this.addActTypeTemplates();
      this.initialized = true;
    }
  }

  /**
   * Load project-specific templates
   */
  async loadProjectTemplates(projectId: string): Promise<void> {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
      if (!response.ok) {
        console.warn('[TaskTemplateService] Failed to load project templates');
        return;
      }

      const data = await response.json();
      const projectTemplates = Array.isArray(data.items) ? data.items : [];

      // Merge project templates (override factory templates with same ID)
      projectTemplates.forEach((template: any) => {
        const mapped: TaskCatalog = {
          id: template.id || template._id,
          label: template.label || '',
          description: template.description || '',
          icon: template.icon || 'Circle',
          color: template.color || 'text-gray-500',
          signature: template.signature,
          valueSchema: template.valueSchema,
          scope: template.scope,
          industry: template.industry,
          createdAt: template.createdAt ? new Date(template.createdAt) : undefined,
          updatedAt: template.updatedAt ? new Date(template.updatedAt) : undefined
        };
        // Store the full template object (including nlpContract) for access
        (mapped as any).nlpContract = template.nlpContract;
        this.templates.set(mapped.id, mapped);
      });

    } catch (error) {
      console.error('[TaskTemplateService] Error loading project templates:', error);
    }
  }

  /**
   * Convert Action Catalog entry to TaskCatalog
   */
  private convertActionToTemplate(action: any): TaskCatalog {
    // Map action ID to new naming convention
    const templateId = this.mapActionIdToTemplateId(action.id);

    // Determine editor type based on action
    const editorType = this.determineEditorType(action.id);

    // Build valueSchema based on action params
    const valueSchema = this.buildValueSchema(action, editorType);

    return {
      id: templateId,
      label: this.getLabel(action.label),
      description: this.getDescription(action.description),
      icon: action.icon || 'Circle',
      color: action.color || 'text-gray-500',
      signature: action.params && Object.keys(action.params).length > 0 ? {
        params: action.params
      } : undefined,
      valueSchema
    };
  }

  /**
   * Map Action Catalog ID to TaskCatalog ID (new naming)
   */
  private mapActionIdToTemplateId(actionId: string): string {
    const mapping: Record<string, string> = {
      'sayMessage': 'SayMessage',
      // ✅ Rimosso 'askQuestion': 'GetData', (ridondante)
      'readFromBackend': 'callBackend',
      'writeToBackend': 'callBackend',
      'sendSMS': 'sendSMS',
      'sendEmail': 'sendEmail',
      'escalateToHuman': 'escalaUmano',
      'escalateToGuardVR': 'escalaGuardVR',
      'hangUp': 'chiudi',
      'assign': 'assegna',
      'clear': 'pulisci',
      'jump': 'salta',
      'playJingle': 'riproduciJingle',
      'logData': 'logData',
      'logLabel': 'logLabel',
      'waitForAgent': 'waitForAgent'
    };
    return mapping[actionId] || actionId.charAt(0).toUpperCase() + actionId.slice(1);
  }

  /**
   * Determine editor type based on action
   */
  private determineEditorType(actionId: string): 'message' | 'ddt' | 'problem' | 'backend' | 'simple' {
    if (actionId === 'sayMessage') return 'message';
    // ✅ Rimosso if (actionId === 'askQuestion') - DataRequest viene gestito automaticamente come 'ddt'
    if (actionId === 'readFromBackend' || actionId === 'writeToBackend') return 'backend';
    return 'simple';
  }

  /**
   * Build valueSchema based on action params and editor type
   */
  private buildValueSchema(action: any, editorType: 'message' | 'ddt' | 'problem' | 'backend' | 'simple'): TaskCatalog['valueSchema'] {
    const keys: Record<string, any> = {};

    if (editorType === 'message') {
      // SayMessage: text (fields directly on task, no value wrapper)
      keys.text = {
        type: 'string',
        required: true,
        ideMapping: {
          control: 'textarea',
          label: 'Testo del messaggio',
          placeholder: 'Inserisci il messaggio...'
        }
      };
    } else if (editorType === 'ddt') {
      // GetData: data, label, stepPrompts, etc. (fields directly on task, no value wrapper)
      keys.data = {
        type: 'ddt',
        required: true,
        ideMapping: {
          control: 'ddt-editor',
          label: 'Struttura DDT'
        }
      };
    } else if (editorType === 'backend') {
      // callBackend: config (fields directly on task, no value wrapper)
      keys.config = {
        type: 'object',
        required: true,
        ideMapping: {
          control: 'json',
          label: 'Configurazione backend'
        }
      };
    } else {
      // Simple actions: map params to value keys
      if (action.params) {
        Object.keys(action.params).forEach(key => {
          keys[key] = {
            type: action.params[key].type === 'string' ? 'string' : 'object',
            required: action.params[key].required || false,
            ideMapping: {
              control: 'text',
              label: key
            }
          };
        });
      }
    }

    return {
      keys
    };
  }

  /**
   * Add templates for ActType mappings (Message, DataRequest, ProblemClassification, etc.)
   */
  private addActTypeTemplates(): void {
    // Message → SayMessage
    this.templates.set('Message', {
      id: 'Message',
      label: 'Message',
      description: 'Sends a text message to the user',
      icon: 'Megaphone',
      color: 'text-green-500',
      valueSchema: {
        editor: 'message',
        keys: {
          text: {
            type: 'string',
            required: true,
            ideMapping: {
              control: 'textarea',
              label: 'Testo del messaggio',
              placeholder: 'Inserisci il messaggio...'
            }
          }
        }
      }
    });

    // DataRequest → GetData
    this.templates.set('DataRequest', {
      id: 'DataRequest',
      label: 'Data Request',
      description: 'Asks for data and waits for user input',
      icon: 'Ear',
      color: 'text-blue-500',
      valueSchema: {
        editor: 'ddt',
        keys: {
          ddt: {
            type: 'ddt',
            required: true,
            ideMapping: {
              control: 'ddt-editor',
              label: 'Struttura DDT'
            }
          }
        }
      }
    });

    // ProblemClassification → ClassifyProblem
    this.templates.set('ProblemClassification', {
      id: 'ProblemClassification',
      label: 'Problem Classification',
      description: 'Classifies user problem into intents',
      icon: 'GitBranch',
      color: 'text-amber-500',
      valueSchema: {
        editor: 'problem',
        keys: {
          intents: {
            type: 'problem',
            required: true,
            ideMapping: {
              control: 'problem-editor',
              label: 'Intents di classificazione'
            }
          }
        }
      }
    });

    // BackendCall → callBackend
    this.templates.set('BackendCall', {
      id: 'BackendCall',
      label: 'Backend Call',
      description: 'Calls backend API',
      icon: 'Server',
      color: 'text-green-500',
      valueSchema: {
        editor: 'backend',
        keys: {
          config: {
            type: 'object',
            required: true,
            ideMapping: {
              control: 'json',
              label: 'Configurazione backend'
            }
          }
        }
      }
    });

    // Summarizer → riepiloga
    this.templates.set('Summarizer', {
      id: 'Summarizer',
      label: 'Summarizer',
      description: 'Summarizes collected data',
      icon: 'FileText',
      color: 'text-cyan-500',
      valueSchema: {
        editor: 'ddt',
        keys: {
          ddt: {
            type: 'ddt',
            required: true,
            ideMapping: {
              control: 'ddt-editor',
              label: 'Struttura DDT'
            }
          }
        }
      }
    });

    // Negotiation → negozia
    this.templates.set('Negotiation', {
      id: 'Negotiation',
      label: 'Negotiation',
      description: 'Negotiates with user',
      icon: 'CheckCircle2',
      color: 'text-indigo-500',
      valueSchema: {
        editor: 'ddt',
        keys: {
          ddt: {
            type: 'ddt',
            required: true,
            ideMapping: {
              control: 'ddt-editor',
              label: 'Struttura DDT'
            }
          }
        }
      }
    });

    // AIAgent → aiAgent
    this.templates.set('AIAgent', {
      id: 'AIAgent',
      label: 'AI Agent',
      description: 'AI-powered agent interaction',
      icon: 'Bot',
      color: 'text-purple-500',
      valueSchema: {
        editor: 'ddt',
        keys: {
          ddt: {
            type: 'ddt',
            required: true,
            ideMapping: {
              control: 'ddt-editor',
              label: 'Struttura DDT'
            }
          }
        }
      }
    });
  }

  /**
   * Get label from multilingual object (defaults to 'en' or first available)
   */
  private getLabel(label: any): string {
    if (typeof label === 'string') return label;
    if (typeof label === 'object') {
      return label.en || label.it || label.pt || Object.values(label)[0] || '';
    }
    return '';
  }

  /**
   * Get description from multilingual object
   */
  private getDescription(description: any): string {
    if (typeof description === 'string') return description;
    if (typeof description === 'object') {
      return description.en || description.it || description.pt || Object.values(description)[0] || '';
    }
    return '';
  }

  /**
   * Get all templates (async)
   */
  async getAllTemplates(): Promise<TaskCatalog[]> {
    await this.initialize();
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID (async, CASE-INSENSITIVE)
   */
  async getTemplate(templateId: string): Promise<TaskCatalog | null> {
    await this.initialize();
    if (!templateId) return null;
    // Try exact match first
    const exact = this.templates.get(templateId);
    if (exact) return exact;
    // Try case-insensitive match
    const normalized = templateId.toLowerCase().trim();
    for (const [key, template] of this.templates.entries()) {
      if (key.toLowerCase() === normalized) {
        return template;
      }
    }
    return null;
  }

  /**
   * Get template by action ID (for backward compatibility, async)
   */
  async getTemplateByActionId(actionId: string): Promise<TaskCatalog | null> {
    await this.initialize();
    const templateId = this.mapActionIdToTemplateId(actionId);
    return this.templates.get(templateId) || null;
  }

  /**
   * Check if template exists (async)
   */
  async hasTemplate(templateId: string): Promise<boolean> {
    await this.initialize();
    return this.templates.has(templateId);
  }

  /**
   * Synchronous getter (returns cached templates, may be empty if not initialized)
   * Use for cases where async is not possible
   */
  getAllTemplatesSync(): TaskCatalog[] {
    return Array.from(this.templates.values());
  }

  /**
   * Synchronous getter (returns cached template, may be null if not initialized, CASE-INSENSITIVE)
   */
  getTemplateSync(templateId: string): TaskCatalog | null {
    if (!templateId) return null;
    // Try exact match first
    const exact = this.templates.get(templateId);
    if (exact) return exact;
    // Try case-insensitive match
    const normalized = templateId.toLowerCase().trim();
    for (const [key, template] of this.templates.entries()) {
      if (key.toLowerCase() === normalized) {
        return template;
      }
    }
    return null;
  }
}

// Export singleton instance
export const taskTemplateService = new TaskTemplateService();

