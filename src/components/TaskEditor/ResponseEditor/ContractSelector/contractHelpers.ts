/**
 * Contract Helpers
 * Utilities for loading and saving Data parsers
 */

import type { DataContract } from '@components/DialogueDataEngine/parsers/contractLoader';
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

    // ✅ PRIORITY 1: Se esiste dataContract, usalo
    if (template?.dataContract) {
      const regexPattern = template.dataContract?.parsers?.find((c: any) => c.type === 'regex')?.patterns?.[0];
      console.log('[CONTRACT] LOAD - From template.dataContract', {
        nodeId: node.id,
        templateId,
        regexPattern: regexPattern || '(none)',
        parsersCount: template.dataContract.parsers?.length || 0
      });
      return template.dataContract as DataContract;
    }

    // ✅ PRIORITY 2: Se esiste semanticContract ma non dataContract, crea DataContract vuoto
    if (template?.semanticContract) {
      console.log('[CONTRACT] LOAD - Creating empty DataContract from SemanticContract', {
        nodeId: node.id,
        templateId,
        hasSemanticContract: true,
        entityLabel: template.semanticContract.entity?.label
      });

      // Crea DataContract iniziale vuoto con parsers array vuoto
      // Le colonne verranno mostrate ma vuote, l'utente può aggiungere contratti manualmente
      const emptyDataContract: DataContract = {
        templateName: template.label || templateId,
        templateId: templateId,
        subDataMapping: {},
        parsers: [] // Array vuoto = nessun engine configurato, ma le colonne possono essere mostrate
      };

      // ✅ DEBUG: Log dettagliato del DataContract creato
      console.log('[CONTRACT] LOAD - Empty DataContract created', {
        nodeId: node.id,
        templateId,
        templateName: emptyDataContract.templateName,
        parsersCount: emptyDataContract.parsers.length,
        parsersArray: emptyDataContract.parsers,
        hasSemanticContract: !!template.semanticContract,
        semanticContractEntity: template.semanticContract?.entity?.label,
        dataContractKeys: Object.keys(emptyDataContract)
      });

      // Salva il DataContract vuoto nel template per evitare di ricrearlo ogni volta
      template.dataContract = emptyDataContract;
      DialogueTaskService.markTemplateAsModified(templateId);

      console.log('[CONTRACT] LOAD - Empty DataContract created and saved', {
        nodeId: node.id,
        templateId,
        savedToTemplate: !!template.dataContract,
        savedContractsCount: template.dataContract?.parsers?.length || 0
      });

      return emptyDataContract;
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
