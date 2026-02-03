// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { DialogueTaskService } from './DialogueTaskService';
import type { EngineEscalation, EngineType } from '../types/semanticContract';

/**
 * Service for managing engine escalation configurations
 * Escalation defines the order in which engines are tried for each node
 */
export class EngineEscalationService {
  /**
   * Save engine escalation configuration to task template
   */
  static async save(nodeId: string, escalation: EngineEscalation): Promise<void> {
    try {
      const template = await DialogueTaskService.getTemplate(nodeId);
      if (!template) {
        throw new Error(`Template not found: ${nodeId}`);
      }

      // Store escalation in template
      if (!template.engineEscalations) {
        template.engineEscalations = [];
      }

      // Remove existing escalation for this node if present
      const existingIndex = template.engineEscalations.findIndex(
        (e: EngineEscalation) => e.nodeId === nodeId
      );

      if (existingIndex >= 0) {
        template.engineEscalations[existingIndex] = escalation;
      } else {
        template.engineEscalations.push(escalation);
      }

      // Mark as modified for persistence
      DialogueTaskService.markTemplateModified(nodeId);

      console.log('[EngineEscalationService] Saved escalation for node', nodeId, {
        engines: escalation.engines.length,
        enabled: escalation.engines.filter(e => e.enabled).length
      });
    } catch (error) {
      console.error('[EngineEscalationService] Error saving escalation:', error);
      throw error;
    }
  }

  /**
   * Load engine escalation configuration from task template
   */
  static async load(nodeId: string): Promise<EngineEscalation | null> {
    try {
      const template = await DialogueTaskService.getTemplate(nodeId);
      if (!template) {
        console.warn('[EngineEscalationService] Template not found:', nodeId);
        return null;
      }

      if (!template.engineEscalations || !Array.isArray(template.engineEscalations)) {
        return null;
      }

      const escalation = template.engineEscalations.find(
        (e: EngineEscalation) => e.nodeId === nodeId
      );

      if (!escalation) {
        console.warn('[EngineEscalationService] No escalation found for node:', nodeId);
        return null;
      }

      return escalation;
    } catch (error) {
      console.error('[EngineEscalationService] Error loading escalation:', error);
      return null;
    }
  }

  /**
   * Get default escalation for a node based on entity type
   * This is used by the wizard to propose engines
   */
  static getDefaultEscalation(nodeId: string, entityType: string | undefined | null): EngineEscalation {
    // Safely convert entityType to string and lowercase
    const type = (entityType && typeof entityType === 'string' ? entityType : 'generic').toLowerCase();

    // Default escalation based on entity type
    let engines: Array<{ type: EngineType; priority: number; enabled: boolean }> = [];

    if (type === 'date' || type.includes('date')) {
      engines = [
        { type: 'regex', priority: 1, enabled: true },
        { type: 'rule_based', priority: 2, enabled: true },
        { type: 'ner', priority: 3, enabled: true },
        { type: 'llm', priority: 4, enabled: true }
      ];
    } else if (type === 'email') {
      engines = [
        { type: 'regex', priority: 1, enabled: true },
        { type: 'rule_based', priority: 2, enabled: true },
        { type: 'llm', priority: 3, enabled: true }
      ];
    } else if (type === 'phone' || type.includes('phone')) {
      engines = [
        { type: 'regex', priority: 1, enabled: true },
        { type: 'rule_based', priority: 2, enabled: true },
        { type: 'ner', priority: 3, enabled: true }
      ];
    } else if (type === 'address' || type.includes('address')) {
      engines = [
        { type: 'ner', priority: 1, enabled: true },
        { type: 'llm', priority: 2, enabled: true }
      ];
    } else if (type === 'name' || type.includes('name')) {
      engines = [
        { type: 'ner', priority: 1, enabled: true },
        { type: 'llm', priority: 2, enabled: true }
      ];
    } else {
      // Generic default escalation
      engines = [
        { type: 'regex', priority: 1, enabled: true },
        { type: 'rule_based', priority: 2, enabled: true },
        { type: 'ner', priority: 3, enabled: true },
        { type: 'llm', priority: 4, enabled: true }
      ];
    }

    return {
      nodeId,
      engines,
      defaultEngine: engines[0]?.type
    };
  }

  /**
   * Check if escalation exists for node
   */
  static async exists(nodeId: string): Promise<boolean> {
    const escalation = await this.load(nodeId);
    return escalation !== null;
  }
}
