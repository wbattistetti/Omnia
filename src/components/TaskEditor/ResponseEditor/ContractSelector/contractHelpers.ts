/**
 * Contract Helpers
 * Utilities for loading and saving Data contracts
 */

import type { DataContract } from '../../../../components/DialogueDataEngine/contracts/contractLoader';
import DialogueTaskService from '../../../../services/DialogueTaskService';

/**
 * Load contract from node
 * Priority:
 * 1. template.dataContract (dal template usando node.templateId)
 * 2. template.patterns → convertito in dataContract (legacy)
 *
 * ❌ RIMOSSO: node.dataContract (override) - i contracts sono sempre nel template
 */
export function loadContractFromNode(node: any): DataContract | null {
  if (!node) return null;

  // ✅ Carica dal template usando templateId
  const templateId = node.templateId;
  if (templateId) {
    const template = DialogueTaskService.getTemplate(templateId);
    if (!template) return null;

    if (template?.dataContract) {
      const regexPattern = template.dataContract?.contracts?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      console.log('[CONTRACT] LOAD - From template', {
        nodeId: node.id,
        templateId,
        regexPattern: regexPattern || '(none)'
      });
      return template.dataContract as DataContract;
    }
  }

  console.log('[CONTRACT] LOAD - No contract found', { nodeId: node.id });
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
