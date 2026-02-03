// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { SemanticContract } from '../types/semanticContract';
import { DialogueTaskService } from './DialogueTaskService';

/**
 * Service for persisting and loading semantic contracts
 * Contracts are saved in the task template, not in instances
 */
export class SemanticContractService {
  /**
   * Save semantic contract to task template
   */
  static async save(taskId: string, contract: SemanticContract): Promise<void> {
    try {
      const template = await DialogueTaskService.getTemplate(taskId);
      if (!template) {
        throw new Error(`Template not found: ${taskId}`);
      }

      // Update contract with version and timestamps
      const updatedContract: SemanticContract = {
        ...contract,
        version: (contract.version || 0) + 1,
        updatedAt: new Date()
      };

      // Update template
      template.semanticContract = updatedContract;

      // Mark as modified for persistence
      DialogueTaskService.markTemplateModified(taskId);

      console.log('[SemanticContractService] Saved contract for task', taskId, {
        version: updatedContract.version,
        subgroupsCount: updatedContract.subgroups.length
      });
    } catch (error) {
      console.error('[SemanticContractService] Error saving contract:', error);
      throw error;
    }
  }

  /**
   * Load semantic contract from task template
   */
  static async load(taskId: string): Promise<SemanticContract | null> {
    try {
      const template = await DialogueTaskService.getTemplate(taskId);
      if (!template) {
        console.warn('[SemanticContractService] Template not found:', taskId);
        return null;
      }

      const contract = template.semanticContract;
      if (!contract) {
        // Silent return - no contract is expected for new nodes
        return null;
      }

      return contract;
    } catch (error) {
      console.error('[SemanticContractService] Error loading contract:', error);
      return null;
    }
  }

  /**
   * Check if contract exists for task
   */
  static async exists(taskId: string): Promise<boolean> {
    const template = DialogueTaskService.getTemplate(taskId);
    return !!(template?.semanticContract);
  }
}
