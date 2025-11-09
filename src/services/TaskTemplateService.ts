import type { TaskTemplate } from '../types/taskTypes';

/**
 * Service for managing TaskTemplates
 * Converts Action Catalog entries to TaskTemplate format
 *
 * This service is added alongside existing Action Catalog usage
 * for gradual migration - existing code continues to work
 */
class TaskTemplateService {
  private templates: Map<string, TaskTemplate> = new Map();
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
   * Load templates from Action Catalog JSON file
   */
  private async loadTemplates(): Promise<void> {
    try {
      // Load Action Catalog (same way as existing code)
      const response = await fetch('/data/actionsCatalog.json');
      if (!response.ok) {
        console.warn('[TaskTemplateService] Failed to load actionsCatalog.json');
        this.addActTypeTemplates(); // At least add ActType templates
        this.initialized = true;
        return;
      }

      const actionsCatalog = await response.json();

      // Convert Action Catalog entries to TaskTemplates
      (actionsCatalog as any[]).forEach((action: any) => {
        const template = this.convertActionToTemplate(action);
        this.templates.set(template.id, template);
      });

      // Add templates for ActType mappings (Message, DataRequest, etc.)
      this.addActTypeTemplates();

      this.initialized = true;
      console.log('[TaskTemplateService] Initialized with', this.templates.size, 'templates');
    } catch (error) {
      console.error('[TaskTemplateService] Error loading templates:', error);
      // Add ActType templates even if Action Catalog fails
      this.addActTypeTemplates();
      this.initialized = true;
    }
  }

  /**
   * Convert Action Catalog entry to TaskTemplate
   */
  private convertActionToTemplate(action: any): TaskTemplate {
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
   * Map Action Catalog ID to TaskTemplate ID (new naming)
   */
  private mapActionIdToTemplateId(actionId: string): string {
    const mapping: Record<string, string> = {
      'sayMessage': 'SayMessage',
      'askQuestion': 'GetData',
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
    if (actionId === 'askQuestion') return 'ddt';
    if (actionId === 'readFromBackend' || actionId === 'writeToBackend') return 'backend';
    return 'simple';
  }

  /**
   * Build valueSchema based on action params and editor type
   */
  private buildValueSchema(action: any, editorType: 'message' | 'ddt' | 'problem' | 'backend' | 'simple'): TaskTemplate['valueSchema'] {
    const keys: Record<string, any> = {};

    if (editorType === 'message') {
      // SayMessage: value.text
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
      // GetData: value.ddt
      keys.ddt = {
        type: 'ddt',
        required: true,
        ideMapping: {
          control: 'ddt-editor',
          label: 'Struttura DDT'
        }
      };
    } else if (editorType === 'backend') {
      // callBackend: value.config
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
      editor: editorType,
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
  async getAllTemplates(): Promise<TaskTemplate[]> {
    await this.initialize();
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID (async)
   */
  async getTemplate(templateId: string): Promise<TaskTemplate | null> {
    await this.initialize();
    return this.templates.get(templateId) || null;
  }

  /**
   * Get template by action ID (for backward compatibility, async)
   */
  async getTemplateByActionId(actionId: string): Promise<TaskTemplate | null> {
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
  getAllTemplatesSync(): TaskTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Synchronous getter (returns cached template, may be null if not initialized)
   */
  getTemplateSync(templateId: string): TaskTemplate | null {
    return this.templates.get(templateId) || null;
  }
}

// Export singleton instance
export const taskTemplateService = new TaskTemplateService();

