// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { EngineConfig } from '../types/semanticContract';
import { DialogueTaskService } from './DialogueTaskService';

/**
 * Service for persisting and loading engine configurations
 * Engines are saved in the task template, not in instances
 */
export class EngineService {
  /**
   * Save engine configuration to task template
   */
  static async save(taskId: string, engine: EngineConfig): Promise<void> {
    try {
      const template = await DialogueTaskService.getTemplate(taskId);
      if (!template) {
        throw new Error(`Template not found: ${taskId}`);
      }

      // Update engine with version and timestamp
      const updatedEngine: EngineConfig = {
        ...engine,
        version: (engine.version || 0) + 1,
        generatedAt: new Date()
      };

      // Update template
      template.engine = updatedEngine;
      template.engineVersion = updatedEngine.version;

      // Mark as modified for persistence
      DialogueTaskService.markTemplateModified(taskId);

      console.log('[EngineService] Saved engine for task', taskId, {
        type: updatedEngine.type,
        version: updatedEngine.version
      });
    } catch (error) {
      console.error('[EngineService] Error saving engine:', error);
      throw error;
    }
  }

  /**
   * Load engine configuration from task template
   */
  static async load(taskId: string): Promise<EngineConfig | null> {
    try {
      const template = await DialogueTaskService.getTemplate(taskId);
      if (!template) {
        console.warn('[EngineService] Template not found:', taskId);
        return null;
      }

      const engine = template.engine;
      if (!engine) {
        console.warn('[EngineService] No engine found for task:', taskId);
        return null;
      }

      return engine;
    } catch (error) {
      console.error('[EngineService] Error loading engine:', error);
      return null;
    }
  }

  /**
   * Check if engine exists for task
   */
  static async exists(taskId: string): Promise<boolean> {
    const engine = await this.load(taskId);
    return engine !== null;
  }

  /**
   * Get engine version for task
   */
  static async getVersion(taskId: string): Promise<number | null> {
    const template = await DialogueTaskService.getTemplate(taskId);
    return template?.engineVersion || null;
  }
}
