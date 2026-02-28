// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Generation Services
 *
 * Funzioni pure per generare constraints, contracts e messaggi template.
 * Queste funzioni aggiornano i template in-place nella cache.
 */

import type { WizardTaskTreeNode } from '../types';
import type { SemanticContract } from '@types/semanticContract';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { generateConstraints } from '../api/wizardApi';
import { generateContractsForAllNodes } from '@utils/wizard/generateContract';
import { generateAllMessagesForNode } from '../api/wizardApi';
import { associateTextsToStructure } from './TemplateCreationService';
import type { NodeStructure } from './TemplateCreationService';
import { TaskType } from '@types/taskTypes';

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

        // ✅ CRITICAL: Genera messaggi r1/r2 per ogni constraint e crea invalid step
        const hasNonRequiredConstraints = constraints.some((c: any) => c.kind && c.kind !== 'required');
        if (hasNonRequiredConstraints) {
          const templateId = template.id || template._id;
          if (templateId) {
            try {
              // ✅ 1. Genera messaggi r1/r2 per tutti i constraints (una chiamata AI per nodo)
              const response = await fetch('/api/constraintMessages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  label: task.label,
                  type: task.type,
                  constraints: constraints.filter((c: any) => c.kind && c.kind !== 'required')
                })
              });

              if (response.ok) {
                const data = await response.json();
                const constraintMessages = data.ai?.messages || [];

                if (Array.isArray(constraintMessages) && constraintMessages.length > 0) {
                  // ✅ 2. Conta quanti messaggi r1/r2 abbiamo (per creare la struttura)
                  const invalidMessages: Array<{ text: string }> = [];

                  constraintMessages.forEach((msg: any) => {
                    if (msg?.r1?.payoff) {
                      invalidMessages.push({ text: String(msg.r1.payoff) });
                    }
                    if (msg?.r2?.payoff) {
                      invalidMessages.push({ text: String(msg.r2.payoff) });
                    }
                  });

                  if (invalidMessages.length > 0) {
                    // ✅ 3. Crea struttura invalid step con GUID (come createStepStructure)
                    const { createStepStructure } = await import('./TemplateCreationService');
                    const { step: invalidStepStructure, guids: invalidGuids } = createStepStructure('invalid', invalidMessages.length);

                    // ✅ 4. Associa GUID ai messaggi e salva traduzioni (meccanismo identico agli altri step)
                    const { v4: uuidv4 } = await import('uuid');
                    const addTranslation = typeof window !== 'undefined' && (window as any).__projectTranslationsContext
                      ? (window as any).__projectTranslationsContext.addTranslation
                      : undefined;

                    const invalidTasks: any[] = [];
                    let messageIndex = 0;

                    constraintMessages.forEach((msg: any) => {
                      if (msg?.r1?.payoff && invalidGuids[messageIndex]) {
                        const guid = invalidGuids[messageIndex++];
                        if (addTranslation) {
                          addTranslation(guid, String(msg.r1.payoff));
                        }
                        invalidTasks.push({
                          id: uuidv4(),
                          type: TaskType.SayMessage, // ✅ Required by cloneEscalationWithNewTaskIds
                          templateId: 'sayMessage',
                          parameters: [{ parameterId: 'text', value: guid }]
                        });
                      }
                      if (msg?.r2?.payoff && invalidGuids[messageIndex]) {
                        const guid = invalidGuids[messageIndex++];
                        if (addTranslation) {
                          addTranslation(guid, String(msg.r2.payoff));
                        }
                        invalidTasks.push({
                          id: uuidv4(),
                          type: TaskType.SayMessage, // ✅ Required by cloneEscalationWithNewTaskIds
                          templateId: 'sayMessage',
                          parameters: [{ parameterId: 'text', value: guid }]
                        });
                      }
                    });

                    // ✅ 5. Crea invalid step usando la struttura (come gli altri step)
                    const invalidStep = {
                      type: 'invalid',
                      escalations: [{
                        escalationId: invalidStepStructure.escalations[0].escalationId,
                        tasks: invalidTasks,
                        actions: invalidTasks.map(t => ({
                          actionId: 'sayMessage',
                          actionInstanceId: uuidv4(),
                          parameters: t.parameters
                        }))
                      }]
                    };

                    // ✅ 6. Aggiungi invalid step agli steps del template
                    if (template.steps[templateId]) {
                      template.steps[templateId].invalid = invalidStep;
                    } else {
                      template.steps.invalid = invalidStep;
                    }

                    console.log(`[AIGenerateConstraints] ✅ Added invalid step with constraint messages to template "${task.label}" (${task.id})`, {
                      templateId,
                      constraintsCount: constraints.length,
                      invalidMessagesCount: invalidMessages.length,
                      invalidTasksCount: invalidTasks.length,
                      invalidGuidsCount: invalidGuids.length
                    });
                  }
                }
              } else {
                console.warn(`[AIGenerateConstraints] ⚠️ Failed to generate constraint messages for "${task.label}" (${task.id})`, {
                  status: response.status,
                  statusText: response.statusText
                });
              }
            } catch (error) {
              console.error(`[AIGenerateConstraints] ⚠️ Error generating constraint messages for "${task.label}" (${task.id}):`, error);
              // Non bloccare il flusso - i constraints sono stati salvati, solo i messaggi sono mancanti
            }
          }
        }

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
 * ✅ FASE 4: Genera semantic contracts per tutti i nodi
 *
 * ARCHITETTURA CORRETTA:
 * - Restituisce SOLO SemanticContract (entity, subentities, outputCanonical, ecc.)
 * - NON tocca template.dataContract (l'Assembler lo farà)
 * - Salva semantic contracts in SemanticContractService per persistenza
 */
export async function AIGenerateContracts(
  templates: Map<string, any>,
  dataSchema: any[]
): Promise<Map<string, SemanticContract>> {
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
    // ✅ NEW: Restituisce Map<string, SemanticContract> invece di modificare template.dataContract
    const generatedContracts = await generateContractsForAllNodes(tempTaskTree);

    console.log(`[AIGenerateContracts] ✅ Semantic contracts generated for ${generatedContracts.size} nodes`);

    // ✅ NEW: Restituisce semantic contracts invece di void
    return generatedContracts;
  } catch (error) {
    console.error('[AIGenerateContracts] ❌ Error generating parsers:', error);
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
