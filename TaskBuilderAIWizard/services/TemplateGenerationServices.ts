// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Generation Services
 *
 * Funzioni pure per generare constraints, contracts e messaggi template.
 * Queste funzioni aggiornano i template in-place nella cache.
 */

import type { WizardTaskTreeNode } from '../types';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { generateConstraints } from '../api/wizardApi';
import { generateContractsForAllNodes } from '@utils/wizard/generateContract';
import { generateAllMessagesForNode } from '../api/wizardApi';
import { associateTextsToStructure } from './TemplateCreationService';
import type { NodeStructure } from './TemplateCreationService';

/**
 * ✅ FASE 3: Genera constraints per tutti i nodi e li aggiunge ai template in-place
 */
export async function AIGenerateConstraints(
  dataSchema: WizardTaskTreeNode[],
  locale: string
): Promise<void> {
  const allTasks = dataSchema.flatMap(node => {
    const tasks: WizardTaskTreeNode[] = [node];
    if (node.subNodes) {
      tasks.push(...node.subNodes);
    }
    return tasks;
  });

  const promises = allTasks.map(async (task) => {
    try {
      const constraints = await generateConstraints([task], undefined, locale);

      // ✅ Aggiorna template in-place nella cache
      const template = DialogueTaskService.getTemplate(task.id);
      if (template) {
        template.constraints = constraints;
        template.dataContracts = constraints; // Alias
        console.log(`[AIGenerateConstraints] ✅ Constraints added to template "${task.label}" (${task.id})`, {
          constraintsCount: constraints.length
        });
      } else {
        console.warn(`[AIGenerateConstraints] ⚠️ Template not found for node "${task.label}" (${task.id})`);
      }
    } catch (error) {
      console.error(`[AIGenerateConstraints] ❌ Error generating constraints for "${task.label}" (${task.id}):`, error);
      throw error;
    }
  });

  await Promise.all(promises);
}

/**
 * ✅ FASE 4: Genera contracts per tutti i nodi e li aggiunge ai template in-place
 */
export async function AIGenerateContracts(
  templates: Map<string, any>,
  dataSchema: any[]
): Promise<void> {
  try {
    // Crea taskTree temporaneo dai template (necessario per generateContractsForAllNodes)
    const { buildNodesFromTemplates } = await import('./TemplateCreationService');
    const rootNode = dataSchema[0];
    const rootTemplate = templates.get(rootNode.id);

    if (!rootTemplate) {
      throw new Error('[AIGenerateContracts] Root template not found');
    }

    const nodes = buildNodesFromTemplates(rootTemplate, templates);
    const tempTaskTree = { nodes }; // TaskTree minimale per generateContractsForAllNodes

    // generateContractsForAllNodes salva già i contracts nel SemanticContractService
    // Dobbiamo anche aggiornare i template in-place
    const generatedContracts = await generateContractsForAllNodes(tempTaskTree);

    // ✅ Aggiorna template in-place nella cache
    generatedContracts.forEach((contract, nodeId) => {
      const template = DialogueTaskService.getTemplate(nodeId);
      if (template) {
        template.dataContract = contract;
        console.log(`[AIGenerateContracts] ✅ Contract added to template "${nodeId}"`);
      } else {
        console.warn(`[AIGenerateContracts] ⚠️ Template not found for node "${nodeId}"`);
      }
    });
  } catch (error) {
    console.error('[AIGenerateContracts] ❌ Error generating contracts:', error);
    throw error;
  }
}

/**
 * ✅ FASE 5: Genera messaggi template per tutti i nodi
 * I messaggi vengono aggiunti SOLO alle translations (usando GUID già esistenti)
 * NON vengono aggiunti al template
 */
export async function AIGenerateTemplateMessages(
  nodeStructures: Map<string, NodeStructure>,
  dataSchema: WizardTaskTreeNode[],
  locale: string
): Promise<void> {
  const allTasks = dataSchema.flatMap(node => {
    const tasks: WizardTaskTreeNode[] = [node];
    if (node.subNodes) {
      tasks.push(...node.subNodes);
    }
    return tasks;
  });

  // Recupera addTranslation dal window context
  const addTranslation = typeof window !== 'undefined' && (window as any).__projectTranslationsContext
    ? (window as any).__projectTranslationsContext.addTranslation
    : undefined;

  if (!addTranslation) {
    console.warn('[AIGenerateTemplateMessages] ⚠️ No translation context available');
  }

  const promises = allTasks.map(async (task) => {
    try {
      const structure = nodeStructures.get(task.id);
      if (!structure) {
        throw new Error(`[AIGenerateTemplateMessages] No structure found for node "${task.label}" (${task.id})`);
      }

      // Genera messaggi (1 AI call per nodo)
      const messages = await generateAllMessagesForNode(task, structure, locale);

      // ✅ Associa testi ai GUID esistenti nella struttura (aggiunge SOLO alle translations)
      associateTextsToStructure(structure, messages, task.id, addTranslation);

      // Conta il numero totale di testi generati
      let totalMessagesCount = 0;
      if (messages.ask?.base) totalMessagesCount += messages.ask.base.length;
      if (messages.ask?.reask) totalMessagesCount += messages.ask.reask.length;
      if (messages.noInput?.base) totalMessagesCount += messages.noInput.base.length;
      if (messages.confirm?.base) totalMessagesCount += messages.confirm.base.length;
      if (messages.notConfirmed?.base) totalMessagesCount += messages.notConfirmed.base.length;
      if (messages.violation?.base) totalMessagesCount += messages.violation.base.length;
      if (messages.disambiguation?.base) totalMessagesCount += messages.disambiguation.base.length;
      if (messages.success?.base) totalMessagesCount += messages.success.base.length;

      console.log(`[AIGenerateTemplateMessages] ✅ Messages generated for "${task.label}" (${task.id})`, {
        messagesCount: totalMessagesCount
      });
    } catch (error) {
      console.error(`[AIGenerateTemplateMessages] ❌ Error generating messages for "${task.label}" (${task.id}):`, error);
      throw error;
    }
  });

  await Promise.all(promises);
}
