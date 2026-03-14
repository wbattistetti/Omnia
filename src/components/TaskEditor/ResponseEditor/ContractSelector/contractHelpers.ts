/**
 * Contract Helpers
 * Utilities for loading and saving Data parsers
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import DialogueTaskService from '@services/DialogueTaskService';

/**
 * Load contract from node
 * Priority:
 * 1. template.dataContract (dal template usando node.templateId)
 * 2. template.semanticContract → crea DataContract vuoto coerente
 * 3. template.patterns → convertito in dataContract (legacy)
 *
 * ❌ RIMOSSO: node.dataContract (override) - i parsers sono sempre nel template
 *
 * ARCHITECTURAL RULE:
 * - Se semanticContract esiste ma dataContract è vuoto, crea DataContract vuoto
 * - Questo permette al Recognition Editor di mostrare le colonne (vuote)
 * - L'utente può poi aggiungere contratti manualmente
 */
export function loadContractFromNode(node: any): DataContract | null {
  if (!node) return null;

  // ✅ Carica dal template usando templateId
  const templateId = node.templateId;
  if (templateId) {
    const template = DialogueTaskService.getTemplate(templateId);
    if (!template) return null;

    // ✅ PRIORITY 1: Se esiste dataContract, unificalo con semanticContract se presente
    if (template?.dataContract) {
      let contract = template.dataContract as DataContract;

      // ✅ Unifica semanticContract in dataContract se presente
      if (template?.semanticContract && !contract.entity) {
        contract = {
          ...contract,
          entity: template.semanticContract.entity,
          subentities: template.semanticContract.subentities,
          constraints: template.semanticContract.constraints,
          normalization: template.semanticContract.normalization,
          redefinitionPolicy: template.semanticContract.redefinitionPolicy,
          outputCanonical: template.semanticContract.outputCanonical,
          canonicalExamples: template.semanticContract.canonicalExamples
        };
      }

      // ✅ Normalizza: parsers → engines (retrocompatibilità)
      if (contract.parsers && !contract.engines) {
        contract.engines = contract.parsers;
      }

      const regexPattern = contract?.engines?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      console.log('[CONTRACT] LOAD - From template.dataContract', {
        nodeId: node.id,
        templateId,
        regexPattern: regexPattern || '(none)',
        enginesCount: contract.engines?.length || 0
      });
      return contract;
    }

    // ✅ PRIORITY 2: Se esiste semanticContract ma non dataContract, crea DataContract unificato
    if (template?.semanticContract) {
      console.log('[CONTRACT] LOAD - Creating DataContract from SemanticContract', {
        nodeId: node.id,
        templateId,
        hasSemanticContract: true,
        entityLabel: template.semanticContract.entity?.label
      });

      // ✅ Crea DataContract unificato con semanticContract
      const unifiedDataContract: DataContract = {
        templateName: template.label || templateId,
        templateId: templateId,
        subDataMapping: {},
        engines: [], // Array vuoto = nessun engine configurato, ma le colonne possono essere mostrate
        // ✅ Unifica semanticContract
        entity: template.semanticContract.entity,
        subentities: template.semanticContract.subentities,
        constraints: template.semanticContract.constraints,
        normalization: template.semanticContract.normalization,
        redefinitionPolicy: template.semanticContract.redefinitionPolicy,
        outputCanonical: template.semanticContract.outputCanonical,
        canonicalExamples: template.semanticContract.canonicalExamples
      };

      // ✅ DEBUG: Log dettagliato del DataContract creato
      console.log('[CONTRACT] LOAD - Unified DataContract created', {
        nodeId: node.id,
        templateId,
        templateName: unifiedDataContract.templateName,
        enginesCount: unifiedDataContract.engines.length,
        hasEntity: !!unifiedDataContract.entity,
        subentitiesCount: unifiedDataContract.subentities?.length || 0
      });

      // Salva il DataContract unificato nel template per evitare di ricrearlo ogni volta
      template.dataContract = unifiedDataContract;
      DialogueTaskService.markTemplateAsModified(templateId);

      console.log('[CONTRACT] LOAD - Unified DataContract created and saved', {
        nodeId: node.id,
        templateId,
        savedToTemplate: !!template.dataContract,
        savedEnginesCount: template.dataContract?.engines?.length || 0
      });

      return unifiedDataContract;
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
