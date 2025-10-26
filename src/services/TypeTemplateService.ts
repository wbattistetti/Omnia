// TypeTemplateService.ts
// Service per gestire i template dei tipi di dato dal database Factory

export interface TypeTemplate {
    id: string;
    name: string;
    label: string;
    type: string;
    icon: string;
    subData: SubDataTemplate[];
    examples: string[];
    constraints: Constraint[];
    metadata: {
        description: string;
        version: string;
        lastUpdated: string;
        author: string;
        tags: string[];
        originalTemplate: boolean;
    };
    permissions: {
        canEdit: boolean;
        canDelete: boolean;
        canShare: boolean;
    };
    auditLog: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SubDataTemplate {
    label: string;
    type: string;
    icon: string;
    examples?: string[];
    constraints?: Constraint[];
}

export interface Constraint {
    type: string;
    value?: any;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    values?: any[];
    format?: string;
}

export class TypeTemplateService {
    private static cache: Record<string, TypeTemplate> = {};
    private static cacheLoaded = false;
    private static loadingPromise: Promise<Record<string, TypeTemplate>> | null = null;

    /**
     * Carica tutti i template dal database Factory
     */
    static async loadTemplates(): Promise<Record<string, TypeTemplate>> {
        if (this.cacheLoaded) {
            return this.cache;
        }

        // Se c'è già una richiesta in corso, aspetta quella
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this._loadTemplatesFromAPI();
        const result = await this.loadingPromise;
        this.loadingPromise = null;
        return result;
    }

    private static async _loadTemplatesFromAPI(): Promise<Record<string, TypeTemplate>> {
        try {
            console.log('[TypeTemplateService] Caricando template dal database Factory...');
            const response = await fetch('/api/factory/type-templates');

            if (!response.ok) {
                throw new Error(`Failed to load templates: ${response.status} ${response.statusText}`);
            }

            this.cache = await response.json();
            this.cacheLoaded = true;
            console.log(`[TypeTemplateService] Caricati ${Object.keys(this.cache).length} template dal database`);
            return this.cache;
        } catch (error) {
            console.error('[TypeTemplateService] Errore nel caricamento dei template:', error);
            this.cache = {};
            return this.cache;
        }
    }

    /**
     * Ottiene un template specifico per nome
     */
    static getTemplate(typeName: string): TypeTemplate | undefined {
        if (!this.cacheLoaded) {
            console.warn('[TypeTemplateService] Cache non ancora caricata, chiamare loadTemplates() prima');
            return undefined;
        }
        return this.cache[typeName];
    }

    /**
     * Ottiene tutti i template dalla cache
     */
    static getAllTemplates(): Record<string, TypeTemplate> {
        if (!this.cacheLoaded) {
            console.warn('[TypeTemplateService] Cache non ancora caricata, chiamare loadTemplates() prima');
            return {};
        }
        return this.cache;
    }

    /**
     * Ricarica i template dal database
     */
    static async reloadTemplates(): Promise<void> {
        try {
            console.log('[TypeTemplateService] Ricaricando template dal database...');
            const response = await fetch('/api/factory/reload-templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to reload templates: ${response.status} ${response.statusText}`);
            }

            // Ricarica la cache locale
            this.cacheLoaded = false;
            await this.loadTemplates();
            console.log('[TypeTemplateService] Template ricaricati con successo');
        } catch (error) {
            console.error('[TypeTemplateService] Errore nel ricaricamento dei template:', error);
            throw error;
        }
    }

    /**
     * Verifica se la cache è caricata
     */
    static isCacheLoaded(): boolean {
        return this.cacheLoaded;
    }

    /**
     * Ottiene il numero di template caricati
     */
    static getTemplateCount(): number {
        return Object.keys(this.cache).length;
    }

    /**
     * Cerca template per tipo o label
     */
    static searchTemplates(query: string): TypeTemplate[] {
        if (!this.cacheLoaded) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        return Object.values(this.cache).filter(template =>
            template.name.toLowerCase().includes(lowerQuery) ||
            template.label.toLowerCase().includes(lowerQuery) ||
            template.type.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Ottiene template per categoria (basato sui tag)
     */
    static getTemplatesByCategory(category: string): TypeTemplate[] {
        if (!this.cacheLoaded) {
            return [];
        }

        return Object.values(this.cache).filter(template =>
            template.metadata.tags.includes(category)
        );
    }

    /**
     * Ottiene template con sub-data
     */
    static getTemplatesWithSubData(): TypeTemplate[] {
        if (!this.cacheLoaded) {
            return [];
        }

        return Object.values(this.cache).filter(template =>
            template.subData && template.subData.length > 0
        );
    }
}

// Export per compatibilità
export default TypeTemplateService;
