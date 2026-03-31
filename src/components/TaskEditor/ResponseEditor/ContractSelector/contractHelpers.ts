/**
 * Contract Helpers
 * Utilities for loading and saving Data parsers
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { Task, TaskTreeNode } from '@types/taskTypes';
import { catalogueLookupTemplateId } from '@utils/taskTreeNodeCatalogueLookup';
import { logContractPersist } from '@utils/contractPersistDebug';
import { resolveNodeDataContract } from '@utils/taskNodeContractResolver';
import { loadDataContractFromTemplateCache } from './contractTemplateLoad';

/**
 * Load contract from node.
 * When `task` is provided, resolution follows task row rules (standalone vs template catalogue id).
 * When omitted, legacy behavior: node.dataContract, then template cache by node.templateId.
 *
 * Priority (legacy, no task):
 * 1. node.dataContract — persisted on the TaskTree node
 * 2. template.dataContract (DialogueTaskService template for node.templateId)
 * 3. template.semanticContract → crea DataContract coerente
 */
export function loadContractFromNode(node: any, taskRow?: Task | null): DataContract | null {
  if (!node) return null;

  if (taskRow != null) {
    return resolveNodeDataContract(taskRow, node);
  }

  if (node.dataContract && typeof node.dataContract === 'object') {
    try {
      const c = JSON.parse(JSON.stringify(node.dataContract)) as DataContract;
      logContractPersist('loadContract', 'using node.dataContract (persisted on tree node)', {
        nodeId: node.id,
        templateId: node.templateId,
        enginesCount: Array.isArray(c.engines) ? c.engines.length : 0,
      });
      return c;
    } catch {
      logContractPersist('loadContract', 'using node.dataContract (clone failed, raw ref)', {
        nodeId: node.id,
      });
      return node.dataContract as DataContract;
    }
  }

  const lookupId = catalogueLookupTemplateId(node as TaskTreeNode);
  if (lookupId) {
    return loadDataContractFromTemplateCache(lookupId, node);
  }

  logContractPersist('loadContract', 'no contract (no node.dataContract, no template data)', {
    nodeId: node.id,
    nodeTemplateId: node.templateId,
  });
  return null;
}

/**
 * @deprecated Contracts non sono più override - devono essere aggiornati nel template
 * Questa funzione non fa più nulla, mantenuta per retrocompatibilità
 */
export function saveContractToNode(node: any, contract: DataContract | null): void {
  console.warn('[DEPRECATED] saveContractToNode - Contracts devono essere aggiornati nel template, non come override');
  // ❌ NON salvare più come overrideif (!node) return;

  if (contract) {
    node.dataContract = contract;
  } else {
    delete node.dataContract;
  }
}
