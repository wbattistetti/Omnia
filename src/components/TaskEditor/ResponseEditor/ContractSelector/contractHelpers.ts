/**
 * Contract Helpers
 * Utilities for loading and saving Data contracts
 */

import type { DataContract } from '../../../../components/DialogueDataEngine/contracts/contractLoader';
import DialogueTaskService from '../../../../services/DialogueTaskService';

/**
 * Load contract from node
 * Priority:
 * 1. node.dataContract (override dell'istanza)
 * 2. template.dataContract (dal template usando node.templateId)
 * 3. template.patterns → convertito in dataContract
 */
export function loadContractFromNode(node: any): DataContract | null {
  if (!node) {
    console.log('[🔍 loadContractFromNode] No node provided');
    return null;
  }

  console.log('[🔍 loadContractFromNode] Loading contract', {
    nodeLabel: node.label,
    nodeId: node.id,
    nodeTemplateId: node.templateId,
    hasNodeDataContract: !!node.dataContract,
    nodeDataContractContractsCount: node.dataContract?.contracts?.length || 0
  });

  // ✅ PRIORITY 1: Override dell'istanza
  if (node.dataContract) {
    console.log('[🔍 loadContractFromNode] ✅ Using node.dataContract (override)');
    return node.dataContract as DataContract;
  }

  // ✅ PRIORITY 2: Carica dal template usando templateId
  const templateId = node.templateId;
  if (templateId) {
    console.log('[🔍 loadContractFromNode] Loading from template', { templateId });
    const template = DialogueTaskService.getTemplate(templateId);

    if (!template) {
      console.warn('[🔍 loadContractFromNode] ⚠️ Template not found', { templateId });
      return null;
    }

    console.log('[🔍 loadContractFromNode] Template loaded', {
      templateId: template.id || template._id,
      templateLabel: template.label || template.name,
      hasTemplateDataContract: !!template.dataContract,
      templateDataContractContractsCount: template.dataContract?.contracts?.length || 0,
      hasNlpContract: !!template.nlpContract,
      hasPatterns: !!template.patterns,
      templateKeys: Object.keys(template).filter(k => k.includes('contract') || k.includes('Contract') || k.includes('pattern') || k.includes('Pattern'))
    });

    if (template?.dataContract) {
      console.log('[🔍 loadContractFromNode] ✅ Using template.dataContract');
      return template.dataContract as DataContract;
    }

    const contractKeys = Object.keys(template).filter(k =>
      k.includes('contract') || k.includes('Contract') ||
      k.includes('pattern') || k.includes('Pattern')
    );
    console.warn('[🔍 loadContractFromNode] ⚠️ Template has no dataContract', {
      templateId: template.id || template._id,
      templateLabel: template.label || template.name,
      templateKeys: contractKeys,
      hasNlpContract: !!template.nlpContract,
      hasPatterns: !!template.patterns,
      nlpContractKeys: template.nlpContract ? Object.keys(template.nlpContract) : [],
      patternsKeys: template.patterns ? Object.keys(template.patterns) : []
    });
  } else {
    console.warn('[🔍 loadContractFromNode] ⚠️ Node has no templateId', {
      nodeLabel: node.label,
      nodeId: node.id
    });
  }

  return null;
}


/**
 * Save contract to node (override dell'istanza)
 */
export function saveContractToNode(node: any, contract: DataContract | null): void {
  if (!node) return;

  if (contract) {
    node.dataContract = contract;
  } else {
    delete node.dataContract;
  }
}
