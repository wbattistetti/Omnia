// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { SemanticContract } from '../types/semanticContract';
import type { Task, TaskTreeNode } from '../types/taskTypes';
import { DialogueTaskService } from './DialogueTaskService';
import { hasValidTemplateIdRef } from '../utils/taskKind';

/**
 * Service for persisting and loading semantic contracts on DialogueTask catalogue rows.
 * Instance / manual node UUIDs must not be passed where a catalogue templateId is required;
 * use contractExistsForTreeNode for editor nodes.
 */
export class SemanticContractService {
  /**
   * Save semantic contract to task template
   */
  static async save(taskId: string, contract: SemanticContract): Promise<void> {
    try {
      const template = DialogueTaskService.findTemplateInCache(taskId);
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
        subgroupsCount: (updatedContract.subentities || updatedContract.subgroups || []).length
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
      const template = DialogueTaskService.findTemplateInCache(taskId);
      if (!template) {
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
   * Check if a semantic contract exists on a catalogue template (wizard / pipeline callers pass template ids).
   */
  static async exists(catalogueTemplateId: string): Promise<boolean> {
    const template = DialogueTaskService.findTemplateInCache(catalogueTemplateId);
    return !!(template?.semanticContract);
  }

  /**
   * True when parser/contract UI must not perform DialogueTask catalogue lookups for this node.
   */
  static shouldSkipCatalogueParserLookups(
    node: TaskTreeNode,
    repoTask: Task | null | undefined
  ): boolean {
    if (repoTask != null && !hasValidTemplateIdRef(repoTask)) {
      return true;
    }
    const tid = node.templateId;
    if (tid == null || String(tid).trim() === '') {
      return true;
    }
    if (String(tid) === String(node.id)) {
      return true;
    }
    if (!DialogueTaskService.findTemplateInCache(tid)) {
      return true;
    }
    return false;
  }

  /**
   * Whether the DialogueTask template for this tree node exposes a semantic contract (sidebar / parser row).
   */
  static async contractExistsForTreeNode(
    node: TaskTreeNode,
    repoTask: Task | null | undefined
  ): Promise<boolean> {
    if (SemanticContractService.shouldSkipCatalogueParserLookups(node, repoTask)) {
      return false;
    }
    const t = DialogueTaskService.findTemplateInCache(node.templateId!);
    return !!(t?.semanticContract);
  }
}
