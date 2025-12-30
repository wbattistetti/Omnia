/**
 * TaskTemplateServiceV2 - Nuovo servizio per caricare TaskCatalog entries
 *
 * Dual mode: carica da task_templates (nuovo) con fallback su AgentActs (vecchio)
 * Supporta scope filtering (general, industry, client)
 */

import type { TaskCatalog } from '../types/taskTypes';

export interface TaskTemplateV2 {
  id: string;
  label: string;
  description?: string;
  scope: string;
  type: string;
  templateId: string;
  defaultValue?: {
    ddtId?: string;
    ddt?: any;
    text?: string;
    intents?: any[];
  };
  category?: string;
  isBuiltIn?: boolean;
  contexts?: string[];
  icon?: string;
  color?: string;
}

class TaskTemplateServiceV2 {
  private baseUrl = '';

  constructor() {
    // IMPORTANTE: Gli endpoint /api/factory sono sempre gestiti da Express (porta 3100)
    // anche se il runtime è VB.NET. Il proxy Vite inoltra /api/factory a Express.
    // Usiamo path relativi per sfruttare il proxy Vite, oppure Express direttamente.
    if (typeof window !== 'undefined') {
      // Usa path relativo per sfruttare il proxy Vite (raccomandato)
      // Il proxy in vite.config.ts inoltra /api/factory a http://localhost:3100
      this.baseUrl = '';
    }
  }

  /**
   * Carica task templates con scope filtering
   *
   * @param scopes - Array di scope (es: ['general', 'industry:utility_gas', 'client:proj123'])
   * @param context - Context opzionale (es: 'NodeRow', 'DDTResponse')
   * @param projectId - ID progetto (aggiunge scope client automaticamente)
   * @param industry - Industry (aggiunge scope industry automaticamente)
   */
  async loadTaskTemplates(
    scopes?: string[],
    context?: string,
    projectId?: string,
    industry?: string
  ): Promise<TaskTemplateV2[]> {
    const startTime = performance.now();
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🚀 [TaskTemplateServiceV2] ⭐ NUOVO SISTEMA ATTIVO ⭐');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[TaskTemplateServiceV2] Parameters:', {
      scopes,
      context,
      projectId,
      industry,
      baseUrl: this.baseUrl
    });

    try {
      // Costruisci query params
      const params = new URLSearchParams();
      if (scopes && scopes.length > 0) {
        params.append('scopes', scopes.join(','));
      }
      if (context) {
        params.append('context', context);
      }
      if (projectId) {
        params.append('projectId', projectId);
      }
      if (industry) {
        params.append('industry', industry);
      }

      const url = `${this.baseUrl}/api/factory/task-templates-v2${params.toString() ? '?' + params.toString() : ''}`;

      console.log('[TaskTemplateServiceV2] 🌐 Fetching from:', url);
      console.log('[TaskTemplateServiceV2] 📡 Full URL:', url);

      const res = await fetch(url);

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No error details');
        console.error('[TaskTemplateServiceV2] ❌ HTTP Error:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText
        });
        throw new Error(`Failed to load task templates: ${res.status} ${res.statusText}`);
      }

      const templates = await res.json();
      const duration = performance.now() - startTime;

      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log(`✅ [TaskTemplateServiceV2] SUCCESS! Loaded ${templates.length} templates in ${duration.toFixed(2)}ms`);
      console.log('═══════════════════════════════════════════════════════════════════════════');

      if (templates.length > 0) {
        console.log('[TaskTemplateServiceV2] 📋 Sample template:', {
          id: templates[0].id,
          label: templates[0].label,
          scope: templates[0].scope,
          templateId: templates[0].templateId,
          type: templates[0].type,
          isBuiltIn: templates[0].isBuiltIn
        });
      }

      // Verifica se ci sono template con _fallback flag (dal vecchio sistema)
      const fallbackCount = templates.filter((t: any) => t._fallback).length;
      if (fallbackCount > 0) {
        console.warn(`[TaskTemplateServiceV2] ⚠️ ${fallbackCount} templates loaded from fallback (AgentActs)`);
      } else {
        console.log('[TaskTemplateServiceV2] ✅ All templates from new system (task_templates collection)');
      }

      return templates;

    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('═══════════════════════════════════════════════════════════════════════════');
      console.error(`❌ [TaskTemplateServiceV2] ERROR after ${duration.toFixed(2)}ms:`, error);
      console.error('═══════════════════════════════════════════════════════════════════════════');
      // Fallback: ritorna array vuoto (il frontend userà il vecchio sistema)
      return [];
    }
  }

  /**
   * ❌ RIMOSSO: loadDDTLibrary (endpoint legacy, collection eliminata)
   * I DDT sono ora gestiti direttamente nei Tasks con type: DataRequest
   */

  /**
   * Risolve un DDT composito
   */
  async resolveDDT(ddtId: string): Promise<any> {
    try {
      // Usa path relativo per sfruttare il proxy Vite
      const url = `/api/factory/ddt-resolve`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddtId })
      });

      if (!res.ok) {
        throw new Error(`Failed to resolve DDT: ${res.status}`);
      }

      const result = await res.json();
      return result.ddt;

    } catch (error) {
      console.error('[TaskTemplateServiceV2] Error resolving DDT:', error);
      throw error;
    }
  }

  /**
   * Converte TaskTemplateV2 al formato IntellisenseItem
   * Per compatibilità con prepareIntellisenseData
   */
  convertToIntellisenseFormat(templates: TaskTemplateV2[]): any[] {
    return templates.map(tmpl => ({
      id: tmpl.id,
      actId: tmpl.id, // Per compatibilità
      label: tmpl.label,
      name: tmpl.label,
      description: tmpl.description || '',
      category: tmpl.category || 'Uncategorized',
      categoryType: 'taskTemplates' as const,
      type: tmpl.type,
      mode: this.mapTypeToMode(tmpl.type),
      templateId: tmpl.templateId,
      defaultValue: tmpl.defaultValue,
      isBuiltIn: tmpl.isBuiltIn || false
    }));
  }

  /**
   * Mappa type a mode per compatibilità
   */
  private mapTypeToMode(type: string): 'DataRequest' | 'Message' | 'DataConfirmation' {
    const mapping: Record<string, 'DataRequest' | 'Message' | 'DataConfirmation'> = {
      'DataRequest': 'DataRequest',
      'Message': 'Message',
      'ProblemClassification': 'Message', // Default
      'BackendCall': 'Message' // Default
    };
    return mapping[type] || 'Message';
  }
}

export const taskTemplateServiceV2 = new TaskTemplateServiceV2();


