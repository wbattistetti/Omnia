/**
 * Loads a DataContract from DialogueTaskService template cache by catalogue template id.
 * Used for instance rows whose catalogue id is task.templateId — never for node-local slot ids.
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import DialogueTaskService from '@services/DialogueTaskService';
import { logContractPersist } from '@utils/contractPersistDebug';

/**
 * Loads contract from the in-memory template cache for a real template row id.
 * Merges semanticContract into dataContract when needed (same rules as legacy editor load).
 */
export function loadDataContractFromTemplateCache(
  templateId: string,
  node: { id?: string }
): DataContract | null {
  if (!templateId) return null;

  const template = DialogueTaskService.getTemplate(templateId);
  if (!template) return null;

  if (template?.dataContract) {
    let contract = template.dataContract as DataContract;

    if (template?.semanticContract && !contract.entity) {
      contract = {
        ...contract,
        entity: template.semanticContract.entity,
        subentities: template.semanticContract.subentities,
        constraints: template.semanticContract.constraints,
        normalization: template.semanticContract.normalization,
        redefinitionPolicy: template.semanticContract.redefinitionPolicy,
        outputCanonical: template.semanticContract.outputCanonical,
        canonicalExamples: template.semanticContract.canonicalExamples,
      };
    }

    const regexPattern = contract?.engines?.find((c: any) => c.type === 'regex')?.patterns?.[0];
    console.log('[CONTRACT] LOAD - From template.dataContract', {
      nodeId: node.id,
      templateId,
      regexPattern: regexPattern || '(none)',
      enginesCount: contract.engines?.length || 0,
    });
    return contract;
  }

  if (template?.semanticContract) {
    logContractPersist('loadContract', 'building DataContract from template.semanticContract', {
      nodeId: node.id,
      templateId,
      entityLabel: template.semanticContract.entity?.label,
    });

    const unifiedDataContract: DataContract = {
      templateName: template.label || templateId,
      templateId: templateId,
      subDataMapping: {},
      engines: [],
      entity: template.semanticContract.entity,
      subentities: template.semanticContract.subentities,
      constraints: template.semanticContract.constraints,
      normalization: template.semanticContract.normalization,
      redefinitionPolicy: template.semanticContract.redefinitionPolicy,
      outputCanonical: template.semanticContract.outputCanonical,
      canonicalExamples: template.semanticContract.canonicalExamples,
    };

    template.dataContract = unifiedDataContract;
    DialogueTaskService.markTemplateAsModified(templateId);

    logContractPersist('loadContract', 'unified DataContract saved to in-memory template cache', {
      nodeId: node.id,
      templateId,
      enginesCount: unifiedDataContract.engines.length,
    });

    return unifiedDataContract;
  }

  return null;
}
