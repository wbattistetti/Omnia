// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode, WizardStepMessages, WizardConstraint } from '../types';
import type { DialogueTask } from '@services/DialogueTaskService';
import type { DataContract, DataContractItem } from '@components/DialogueDataEngine/contracts/contractLoader';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import { cloneTemplateSteps } from '@utils/taskUtils';
import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Map emoji to icon name for DialogueTask (backward compatibility)
 * DialogueTask.icon expects icon name (e.g. "FileText"), not emoji
 */
function mapEmojiToIconName(emoji: string): string {
  const emojiMap: Record<string, string> = {
    '📅': 'Calendar',
    '📆': 'Calendar',
    '👤': 'User',
    '👥': 'Users',
    '📍': 'MapPin',
    '🏠': 'Home',
    '📧': 'Mail',
    '📞': 'Phone',
    '⏰': 'Clock',
    '🔢': 'Hash',
    '💳': 'CreditCard',
    '🏥': 'Hospital',
    '⚕️': 'Stethoscope',
    '🍽️': 'Utensils',
    '📦': 'Package',
  };
  return emojiMap[emoji] || 'FileText';
}

/**
 * Count expected translations from WizardStepMessages
 * Each message in each escalation generates one translation
 */
function countExpectedTranslations(messages: WizardStepMessages): number {
  let count = 0;

  if (messages.ask?.base) count += messages.ask.base.length;
  if (messages.ask?.reask) count += messages.ask.reask.length;
  if (messages.noInput?.base) count += messages.noInput.base.length;
  if (messages.confirm?.base) count += messages.confirm.base.length;
  if (messages.notConfirmed?.base) count += messages.notConfirmed.base.length;
  if (messages.violation?.base) count += messages.violation.base.length;
  if (messages.success?.base) count += messages.success.base.length;

  return count;
}

/**
 * Generalizes a label by removing context-specific references
 *
 * Example:
 * - "Chiedi la data di nascita del paziente" → "Data di nascita"
 * - "Chiedi il nome del cliente" → "Nome"
 */
export function generalizeLabel(label: string): string {
  // Remove common prefixes
  let generalized = label
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+(la|il|lo|gli|le|un|una|uno)\s+/i, '')
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+/i, '')
    .trim();

  // Remove context-specific references (del paziente, del cliente, ecc.)
  generalized = generalized.replace(/\s+(del|della|dello|dei|degli|delle)\s+\w+$/i, '');

  return generalized || label;  // Fallback if generalization fails
}

/**
 * ✅ FASE 1: Crea escalation con GUID senza testo (deterministico)
 * Genera solo la struttura logica, senza chiamare AI o salvare traduzioni
 */
function createEscalationWithGuid(): { escalation: any; guid: string } {
  const textKey = uuidv4();
  const taskId = uuidv4();
  const escalationId = uuidv4();
  const templateId = 'sayMessage';

  const taskType = templateIdToTaskType(templateId);
  if (taskType === TaskType.UNDEFINED) {
    throw new Error(`[TemplateCreationService] Cannot determine task type from templateId '${templateId}'.`);
  }

  const escalation = {
    escalationId,
    tasks: [
      {
        id: taskId,
        type: taskType,
        templateId: templateId,
        parameters: [
          {
            parameterId: 'text',
            value: textKey, // GUID senza testo ancora
          },
        ],
      },
    ],
  };

  return { escalation, guid: textKey };
}

/**
 * Helper per creare una escalation con un messaggio
 * Allineato con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Genera GUID e salva traduzioni invece di usare testo letterale
 * ⚠️ DEPRECATED: Usa createEscalationWithGuid() per FASE 1, poi associa testi
 *
 * LOG TRACING:
 * - Input: text (messaggio), addTranslation callback
 * - Output: escalation con task nel formato corretto
 * - Validazione: templateIdToTaskType('sayMessage') deve restituire TaskType.SayMessage
 */
function createEscalationFromMessage(
  text: string,
  addTranslation?: (guid: string, text: string) => void
): any {
  // ✅ STEP 1: Genera GUID per la chiave di traduzione
  const textKey = uuidv4();
  const taskId = uuidv4();
  const templateId = 'sayMessage';

  // ✅ STEP 2: Salva traduzione
  const addTranslationFn = addTranslation || (() => {
    // Fallback: use window context if available
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const ctx = (window as any).__projectTranslationsContext;
      if (ctx.addTranslation) {
        return ctx.addTranslation;
      } else if (ctx.addTranslations) {
        return (guid: string, text: string) => ctx.addTranslations({ [guid]: text });
      }
    }
    return (guid: string, text: string) => {
      console.warn('[TemplateCreationService] ⚠️ No translation context available, translation not saved:', { guid, text: text.substring(0, 50) });
    };
  })();

  if (addTranslationFn && typeof addTranslationFn === 'function') {
    addTranslationFn(textKey, text);
    // ✅ DEBUG: Log translation addition
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const ctx = (window as any).__projectTranslationsContext;
      const hasTranslation = textKey in (ctx.translations || {});
      console.log('[TemplateCreationService] ✅ Translation added', {
        guid: textKey,
        textPreview: text.substring(0, 50),
        hasTranslationInContext: hasTranslation,
        totalTranslations: Object.keys(ctx.translations || {}).length
      });
    }
  }

  // ✅ STEP 3: Determina taskType
  const taskType = templateIdToTaskType(templateId);

  if (taskType === TaskType.UNDEFINED) {
    const errorMessage = `[TemplateCreationService] Cannot determine task type from templateId '${templateId}'. This is a bug in task creation.`;
    throw new Error(errorMessage);
  }

  const escalation = {
    escalationId: uuidv4(),
    tasks: [
      {
        id: taskId,
        type: taskType,
        templateId: templateId,
        parameters: [
          {
            parameterId: 'text',
            value: textKey, // ✅ GUID invece di testo letterale
          },
        ],
      },
    ],
  };

  return escalation;
}

/**
 * ✅ FASE 1: Crea step structure con escalation e GUID (senza testi)
 * Deterministico, non chiama AI, non salva traduzioni
 */
function createStepStructure(
  stepType: string,
  escalationCount: number
): { step: any; guids: string[] } {
  const guids: string[] = [];
  const escalations: any[] = [];

  for (let i = 0; i < escalationCount; i++) {
    const { escalation, guid } = createEscalationWithGuid();
    escalations.push(escalation);
    guids.push(guid);
  }

  return {
    step: {
      type: stepType,
      escalations,
    },
    guids,
  };
}

/**
 * ✅ FASE 1: Crea struttura completa per un nodo (step/escalation/GUID senza testi)
 */
export interface NodeStructure {
  nodeId: string;
  steps: Record<string, { step: any; guids: string[] }>;
  messageMatrix: Array<{ guid: string; stepType: string; escalationIndex: number }>;
}

/**
 * ✅ FASE 2: Associa testi generati dall'AI ai GUID esistenti nella struttura
 */
export function associateTextsToStructure(
  structure: NodeStructure,
  messages: WizardStepMessages,
  nodeId: string,
  addTranslation?: (guid: string, text: string) => void
): void {
  const addTranslationFn = addTranslation || (() => {
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const ctx = (window as any).__projectTranslationsContext;
      if (ctx.addTranslation) {
        return ctx.addTranslation;
      } else if (ctx.addTranslations) {
        return (guid: string, text: string) => ctx.addTranslations({ [guid]: text });
      }
    }
    return (guid: string, text: string) => {
      console.warn('[associateTextsToStructure] ⚠️ No translation context available', { guid, text: text.substring(0, 50) });
    };
  })();

  // Mappa stepType a array di testi
  const textsByStepType: Record<string, string[]> = {};
  if (messages.ask?.base) textsByStepType.start = messages.ask.base;
  if (messages.ask?.reask) textsByStepType.noMatch = messages.ask.reask;
  if (messages.noInput?.base) textsByStepType.noInput = messages.noInput.base;
  if (messages.confirm?.base) textsByStepType.confirmation = messages.confirm.base;
  if (messages.notConfirmed?.base) textsByStepType.notConfirmed = messages.notConfirmed.base;
  if (messages.violation?.base) textsByStepType.violation = messages.violation.base;
  if (messages.disambiguation?.base) textsByStepType.disambiguation = messages.disambiguation.base;
  if (messages.success?.base) textsByStepType.success = messages.success.base;

  // Associa testi ai GUID
  Object.entries(structure.steps).forEach(([stepType, { guids }]) => {
    const texts = textsByStepType[stepType] || [];

    if (texts.length !== guids.length) {
      console.warn(`[associateTextsToStructure] Mismatch for ${stepType}: ${texts.length} texts but ${guids.length} GUIDs`, {
        nodeId,
        stepType,
        textsCount: texts.length,
        guidsCount: guids.length
      });
    }

    // Associa ogni testo al suo GUID
    guids.forEach((guid, index) => {
      const text = texts[index];
      if (text) {
        addTranslationFn(guid, text);
      } else {
        console.warn(`[associateTextsToStructure] Missing text for GUID ${guid} at index ${index}`, {
          nodeId,
          stepType,
          index
        });
      }
    });
  });
}

/**
 * ✅ FASE 1: Crea struttura deterministica completa per un nodo
 * Crea step/escalation/GUID senza testi (deterministico)
 *
 * @deprecated Usa createTemplateStructure() - questo è un alias per compatibilità
 */
export function createNodeStructure(node: WizardTaskTreeNode): NodeStructure {
  return createTemplateStructure(node);
}

/**
 * ✅ FASE 1: Crea struttura deterministica completa per un nodo
 * Crea step/escalation/GUID senza testi (deterministico)
 * Questa è la funzione principale - crea TUTTO: escalation, messageMatrix, GUID
 */
export function createTemplateStructure(node: WizardTaskTreeNode): NodeStructure {
  // Configurazione deterministica: quanti messaggi per ogni stepType
  const stepConfig: Record<string, number> = {
    start: 1,           // 1 messaggio iniziale
    noMatch: 3,         // 3 escalation
    noInput: 3,         // 3 escalation
    confirmation: 1,    // 1 messaggio di conferma
    notConfirmed: 1,    // 1 messaggio
    violation: 2,       // 2 messaggi
    disambiguation: 1,  // 1 messaggio
    success: 1,         // 1 messaggio
  };

  const steps: Record<string, { step: any; guids: string[] }> = {};
  const messageMatrix: Array<{ guid: string; stepType: string; escalationIndex: number }> = [];

  // Crea struttura per ogni stepType
  Object.entries(stepConfig).forEach(([stepType, count]) => {
    const { step, guids } = createStepStructure(stepType, count);
    steps[stepType] = { step, guids };

    // Aggiungi alla messageMatrix
    guids.forEach((guid, index) => {
      messageMatrix.push({
        guid,
        stepType,
        escalationIndex: index,
      });
    });
  });

  return {
    nodeId: node.id,
    steps,
    messageMatrix,
  };
}

/**
 * Helper per creare uno step con escalations
 * Allineato con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 * ⚠️ DEPRECATED: Usa createStepStructure() per FASE 1
 *
 * LOG TRACING:
 * - Input: stepType, messages[], addTranslation callback
 * - Output: step con escalations array
 */
function createStepWithEscalations(
  stepType: string,
  messages: string[],
  addTranslation?: (guid: string, text: string) => void
): any {
  const escalations = messages.map((msg) => {
    return createEscalationFromMessage(msg, addTranslation);
  });

  const step = {
    type: stepType,
    escalations,
  };

  return step;
}

/**
 * ✅ FASE 2: Converte struttura con testi associati in steps dictionary
 * Usa la struttura già creata invece di creare nuove escalation
 * Questa funzione usa i GUID già esistenti nella struttura (deterministici)
 */
export function convertStructureToStepsDictionary(
  structure: NodeStructure,
  templateId: string
): Record<string, Record<string, any>> {
  const stepRecord: Record<string, any> = {};

  // Usa gli step dalla struttura (già hanno i GUID corretti)
  Object.entries(structure.steps).forEach(([stepType, { step }]) => {
    stepRecord[stepType] = step;
  });

  return { [templateId]: stepRecord };
}

/**
 * Converts WizardStepMessages to steps dictionary format with escalations
 * Dictionary: { "templateId": { "start": { type: "start", escalations: [...] }, ... } }
 *
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 * ⚠️ DEPRECATED: Usa convertStructureToStepsDictionary() per nuova implementazione
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId, addTranslation callback
 * - Output: steps dictionary con formato corretto
 */
function convertMessagesToStepsDictionary(
  messages: WizardStepMessages,
  templateId: string,
  addTranslation?: (guid: string, text: string) => void
): Record<string, Record<string, any>> {
  // ✅ EVENT-DRIVEN: Set current template ID for translation tracking
  if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
    const ctx = (window as any).__projectTranslationsContext;
    if (ctx.setCurrentTemplateId) {
      ctx.setCurrentTemplateId(templateId);
      console.log('[convertMessagesToStepsDictionary] 📌 Set current template ID for tracking', { templateId });
    }
  }

  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    stepRecord.start = createStepWithEscalations('start', messages.ask.base, addTranslation);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask, addTranslation);
  }

  // ✅ FIX: noInput messages -> noInput step (Non ho sentito)
  if (messages.noInput?.base && messages.noInput.base.length > 0) {
    stepRecord.noInput = createStepWithEscalations('noInput', messages.noInput.base, addTranslation);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base, addTranslation);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base, addTranslation);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base, addTranslation);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    stepRecord.success = createStepWithEscalations('success', messages.success.base, addTranslation);
  }

  const result = { [templateId]: stepRecord };

  // ✅ EVENT-DRIVEN: Clear current template ID after template creation
  if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
    const ctx = (window as any).__projectTranslationsContext;
    if (ctx.setCurrentTemplateId) {
      ctx.setCurrentTemplateId(null);
      console.log('[convertMessagesToStepsDictionary] 📌 Cleared current template ID', { templateId });
    }
  }

  return result;
}

// ❌ REMOVED: convertWizardNLPToDataContract function
// No longer needed - node.dataContract is already DataContract (no conversion needed)

/**
 * ✅ FASE 2: Crea template da strutture già create (deterministico)
 * Crea lo scheletro dei template con step/GUID (senza constraints/contracts/messaggi)
 * Constraints e contracts verranno aggiunti dopo in-place
 * Messaggi vanno solo in translations (usando GUID già esistenti)
 *
 * @param fakeTree - Structure generated by wizard (WizardTaskTreeNode[])
 * @param nodeStructures - Map di nodeId -> NodeStructure (già creata in FASE 1)
 * @param shouldBeGeneral - Flag indicating if template is generalizable
 * @returns Map<nodeId, DialogueTask> - One template per node (solo struttura, senza constraints/contracts)
 */
export async function createTemplatesFromStructures(
  fakeTree: WizardTaskTreeNode[],
  nodeStructures: Map<string, NodeStructure>,
  shouldBeGeneral: boolean = false
): Promise<Map<string, DialogueTask>> {
  const templates = new Map<string, DialogueTask>();

  /**
   * Recursive helper to create template for a node
   */
  const createTemplateForNode = async (node: WizardTaskTreeNode): Promise<DialogueTask> => {
    const templateId = node.id;

    // Get structure for this node
    const structure = nodeStructures.get(node.id);
    if (!structure) {
      throw new Error(
        `[createTemplatesFromStructures] CRITICAL: No structure found for node "${node.label}" (id: ${node.id})`
      );
    }

    // Collect subTasksIds from children
    const subTasksIds: string[] = [];
    if (node.subNodes && node.subNodes.length > 0) {
      for (const subNode of node.subNodes) {
        const subTemplateId = subNode.id;
        subTasksIds.push(subTemplateId);

        // Create template for child (recursive)
        if (!templates.has(subTemplateId)) {
          const subTemplate = await createTemplateForNode(subNode);
          templates.set(subTemplateId, subTemplate);
        }
      }
    }

    // ✅ Usa convertStructureToStepsDictionary (usa GUID già esistenti)
    const steps = convertStructureToStepsDictionary(structure, templateId);

    // Create template (SENZA constraints/contracts - verranno aggiunti dopo)
    const template: DialogueTask = {
      id: templateId,
      _id: templateId,
      templateId: null,
      name: generalizeLabel(node.label).toLowerCase().replace(/\s+/g, '_'),
      label: generalizeLabel(node.label),
      type: TaskType.UtteranceInterpretation,
      icon: node.emoji ? mapEmojiToIconName(node.emoji) : (node.icon || 'FileText'),
      subTasksIds: subTasksIds.length > 0 ? subTasksIds : undefined,
      steps: steps, // ✅ Usa struttura già creata (GUID deterministici)
      // ❌ NO constraints/contracts qui - verranno aggiunti dopo in-place
      shouldBeGeneral: shouldBeGeneral,
    };

    templates.set(templateId, template);
    return template;
  };

  // Create template for each root node
  for (const rootNode of fakeTree) {
    if (!templates.has(rootNode.id)) {
      await createTemplateForNode(rootNode);
    }
  }

  return templates;
}

/**
 * Creates a template for each node in the wizard-generated structure
 *
 * ⚠️ DEPRECATED: Usa createTemplatesFromStructures() per nuova implementazione
 * Questa funzione è mantenuta per compatibilità con codice legacy
 *
 * Each node gets its own template with:
 * - Generalized label
 * - Steps (generalized messages)
 * - Constraints and NLP contract (referenced in template)
 * - References to child templates (subTasksIds)
 *
 * @param fakeTree - Structure generated by wizard (WizardTaskTreeNode[])
 * @param messagesGeneralized - Generalized messages (one set for all nodes, or per-node)
 * @param constraintsMap - Map of nodeId -> constraints
 * @param dataContractsMap - Map of nodeId -> DataContract
 * @param shouldBeGeneral - Flag indicating if template is generalizable
 * @returns Map<nodeId, DialogueTask> - One template per node
 */
export async function createTemplatesFromWizardData(
  fakeTree: WizardTaskTreeNode[],
  messagesGeneralized: Map<string, WizardStepMessages>,
  constraintsMap: Map<string, WizardConstraint[]>,
  dataContractsMap: Map<string, DataContract>,
  shouldBeGeneral: boolean = false,
  addTranslation?: (guid: string, text: string) => void
): Promise<Map<string, DialogueTask>> {
  const templates = new Map<string, DialogueTask>();

  /**
   * Recursive helper to create template for a node
   */
  const createTemplateForNode = async (node: WizardTaskTreeNode): Promise<DialogueTask> => {
    // ✅ INVARIANT CHECK: node.id MUST equal node.templateId (single source of truth)
    if (node.id !== node.templateId) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: node.id (${node.id}) !== node.templateId (${node.templateId}) for node "${node.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use node.id as the single source of truth (no fallback, no templateId)
    const templateId = node.id;

    // Collect subTasksIds from children
    const subTasksIds: string[] = [];
    if (node.subNodes && node.subNodes.length > 0) {
      // ✅ Use for...of instead of forEach to support await
      for (const subNode of node.subNodes) {
        // ✅ INVARIANT CHECK: subNode.id MUST equal subNode.templateId
        if (subNode.id !== subNode.templateId) {
          throw new Error(
            `[TemplateCreationService] CRITICAL: subNode.id (${subNode.id}) !== subNode.templateId (${subNode.templateId}) for subNode "${subNode.label}". ` +
            `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
          );
        }

        // ✅ ALWAYS use subNode.id (no fallback)
        const subTemplateId = subNode.id;
        subTasksIds.push(subTemplateId);

        // Create template for child (recursive)
        if (!templates.has(subTemplateId)) {
          const subTemplate = await createTemplateForNode(subNode);
          templates.set(subTemplateId, subTemplate);
        }
      }
    }

    // ✅ Get messages for this specific node from the map
    const nodeMessages = messagesGeneralized.get(node.id);
    if (!nodeMessages) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: Node "${node.label}" (id: ${node.id}) is missing messages. ` +
        `This should never happen - checkAndComplete should have prevented this. ` +
        `Available message IDs: ${Array.from(messagesGeneralized.keys()).join(', ')}.`
      );
    }

    // ✅ D2: Se arriviamo qui, nodeMessages esiste (garantito da verifiche upstream)
    const messagesToUse = nodeMessages;

    // ✅ REMOVED: Translation tracking non più necessario
    // Le traduzioni vengono già salvate in associateTextsToStructure durante la generazione

    // Convert generalized messages to steps dictionary (per-node messages)
    console.log('[createTemplatesFromWizardData] 🔍 Creating template', {
      templateId,
      nodeLabel: node.label,
      hasAddTranslation: !!addTranslation,
      addTranslationType: typeof addTranslation
    });
    const steps = convertMessagesToStepsDictionary(messagesToUse, templateId, addTranslation);

    // Get constraints and data contract for this node
    const constraints = constraintsMap.get(node.id) || [];
    // ✅ dataContract is already DataContract (no conversion needed)
    const dataContract = dataContractsMap.get(node.id);

    // Create template
    const template: DialogueTask = {
      id: templateId,
      _id: templateId,  // For MongoDB compatibility
      templateId: null,  // Template has always templateId === null
      name: generalizeLabel(node.label).toLowerCase().replace(/\s+/g, '_'),  // Canonical name
      label: generalizeLabel(node.label),  // Generalized label
      type: TaskType.UtteranceInterpretation,  // Default to UtteranceInterpretation
      // ✅ Map emoji to icon name for DialogueTask (backward compatibility)
      // DialogueTask.icon expects icon name (e.g. "FileText"), not emoji
      icon: node.emoji ? mapEmojiToIconName(node.emoji) : (node.icon || 'FileText'),
      subTasksIds: subTasksIds.length > 0 ? subTasksIds : undefined,
      steps: steps,  // Dictionary: { "templateId": { "start": {...}, ... } }
      dataContracts: constraints.length > 0 ? constraints : undefined,
      constraints: constraints.length > 0 ? constraints : undefined,  // Alias
      // ❌ REMOVED: nlpContract (legacy field)
      // ✅ dataContract is already DataContract (no conversion needed)
      dataContract: dataContract,
      shouldBeGeneral: shouldBeGeneral,  // Flag for UI decision
    };

    templates.set(templateId, template);
    return template;
  };

  // Create template for each root node
  for (const rootNode of fakeTree) {
    // ✅ INVARIANT CHECK: rootNode.id MUST equal rootNode.templateId
    if (rootNode.id !== rootNode.templateId) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId}) for rootNode "${rootNode.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use rootNode.id (no fallback)
    const rootTemplateId = rootNode.id;

    if (!templates.has(rootTemplateId)) {
      await createTemplateForNode(rootNode);
    }
  }

  return templates;
}

/**
 * Converts contextualized messages to steps with escalations
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId, addTranslation callback
 * - Output: stepRecord con formato corretto (senza wrapper templateId)
 */
function convertContextualizedMessagesToSteps(
  messages: WizardStepMessages,
  templateId: string,
  addTranslation?: (guid: string, text: string) => void
): Record<string, any> {
  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    stepRecord.start = createStepWithEscalations('start', messages.ask.base, addTranslation);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask, addTranslation);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base, addTranslation);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base, addTranslation);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base, addTranslation);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    stepRecord.success = createStepWithEscalations('success', messages.success.base, addTranslation);
  }

  return stepRecord;
}

/**
 * Builds TaskTreeNode[] from templates (for cloneTemplateSteps)
 */
export function buildNodesFromTemplates(
  rootTemplate: DialogueTask,
  allTemplates: Map<string, DialogueTask>
): TaskTreeNode[] {
  const buildNode = (template: DialogueTask): TaskTreeNode => {
    const node: TaskTreeNode = {
      id: template.id || '',
      templateId: template.id || '',
      label: template.label || '',
      type: template.type,
      icon: template.icon,
    };

    // Build subNodes from subTasksIds
    if (template.subTasksIds && template.subTasksIds.length > 0) {
      node.subNodes = template.subTasksIds
        .map(subTemplateId => {
          const subTemplate = allTemplates.get(subTemplateId);
          return subTemplate ? buildNode(subTemplate) : null;
        })
        .filter((n): n is TaskTreeNode => n !== null);
    }

    return node;
  };

  return [buildNode(rootTemplate)];
}

/**
 * Creates a contextualized instance from templates
 *
 * FLUSSO LINEARE:
 * 1. Clona step esattamente come nel template (nuovi GUID, step identici)
 * 2. Copia traduzioni template → nuovi GUID (root + sub-nodi)
 * 3. POI chiama AI per adattare (genera messaggi contestualizzati e sovrascrive solo traduzioni)
 *
 * @param rootTemplate - Root template (generalized)
 * @param allTemplates - All templates (including children)
 * @param contextualizedMessagesMap - ⚠️ DEPRECATED: Non più usato per applicare messaggi (mantenuto per backward compatibility)
 * @param taskLabel - Contextualized task label (usato come contextLabel per AI)
 * @param rowId - Task instance ID (ALWAYS equals row.id which equals task.id when task exists)
 * @param addTranslation - Optional callback to add translations
 * @param adaptAllNormalSteps - If true, contextualize all nodes; if false, only root node (default: false)
 * @returns Task instance
 */
export async function createContextualizedInstance(
  rootTemplate: DialogueTask,
  allTemplates: Map<string, DialogueTask>,
  contextualizedMessagesMap: Map<string, WizardStepMessages>, // ⚠️ DEPRECATED: Non più usato
  taskLabel: string,
  rowId: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  addTranslation?: (guid: string, text: string) => void,
  adaptAllNormalSteps: boolean = false // ✅ Flag to control contextualization scope
): Promise<any> {
  // ✅ FASE 1: Clona step esattamente come nel template (nuovi GUID, step identici)
  const nodes = buildNodesFromTemplates(rootTemplate, allTemplates);
  const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(rootTemplate, nodes);

  // ✅ FASE 2: Crea istanza con step clonati (SENZA applicare messaggi contestualizzati)
  const instance: any = {
    id: rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    type: rootTemplate.type || 3,  // TaskType.UtteranceInterpretation
    templateId: rootTemplate.id,  // Reference to root template
    label: taskLabel,  // Contextualized label
    steps: clonedSteps,  // ✅ Step clonati identici al template
  };

  // ✅ FASE 3: Copia traduzioni template → nuovi GUID (root + sub-nodi)
  // Questo è CRITICO: senza questa chiamata, i nuovi GUID non hanno traduzioni
  if (guidMapping && guidMapping.size > 0) {
    const rootTemplateId = rootTemplate.id || rootTemplate._id;
    if (rootTemplateId) {
      try {
        const taskTreeMergeUtils = await import('@utils/taskTreeMergeUtils');
        if (!taskTreeMergeUtils.copyTranslationsForClonedSteps) {
          throw new Error('copyTranslationsForClonedSteps not found in taskTreeMergeUtils');
        }
        const copyTranslationsForClonedSteps = taskTreeMergeUtils.copyTranslationsForClonedSteps;
        await copyTranslationsForClonedSteps(instance, rootTemplateId, guidMapping);
        console.log('[createContextualizedInstance] ✅ Traduzioni copiate per istanza', {
          instanceId: instance.id,
          guidMappingSize: guidMapping.size,
          rootTemplateId
        });
      } catch (err) {
        console.error('[createContextualizedInstance] ❌ Errore copiando traduzioni:', err);
        // Non bloccare il flusso - l'istanza viene comunque creata
      }
    }
  } else {
    console.warn('[createContextualizedInstance] ⚠️ Nessun GUID mapping disponibile per copiare traduzioni', {
      instanceId: instance.id,
      hasGuidMapping: !!guidMapping,
      guidMappingSize: guidMapping?.size || 0
    });
  }

  // ✅ FASE 4: POI chiama AI per adattare (genera messaggi contestualizzati e sovrascrive solo traduzioni)
  // Questo avviene DOPO la clonazione e copia traduzioni
  try {
    const { AdaptTaskTreePromptToContext } = await import('@utils/taskTreePromptAdapter');
    await AdaptTaskTreePromptToContext(instance, taskLabel, adaptAllNormalSteps);
    console.log('[createContextualizedInstance] ✅ Prompt adattati al contesto', {
      instanceId: instance.id,
      adaptAllNormalSteps,
      taskLabel
    });
  } catch (err) {
    console.error('[createContextualizedInstance] ⚠️ Errore durante adattamento prompt (continua con template):', err);
    // Non bloccare il flusso - l'istanza usa i prompt del template
  }

  return instance;
}
