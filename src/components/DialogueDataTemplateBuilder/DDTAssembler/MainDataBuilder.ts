import { buildStepGroup } from './StepBuilder';
import { StepGroup } from './types';
import { enrichAndTranslateConstraints } from './ConstraintBuilder';
import { v4 as uuidv4 } from 'uuid';
import { buildStepsWithSubData, SubDataStepMessages } from './buildStepMessagesFromResults';
import nlpTypesConfig from '../../../../config/nlp-types.json';
import type { Kind } from '../../DialogueDataEngine/model/ddt.v2.types';

/**
 * Maps AI semantic types to frontend Kind values using the shared config.
 * Falls back to 'generic' for unknown types.
 *
 * @param aiType - The type returned by the AI (e.g., 'phone', 'taxCode', 'fiscalCode', or TaskType enum number)
 * @returns The corresponding frontend Kind or 'generic' as fallback
 */
function mapAITypeToKind(aiType: string | number | undefined): Kind | undefined {
  if (!aiType && aiType !== 0) return undefined;

  // ✅ Convert to string if it's a number (TaskType enum) or other type
  const typeString = typeof aiType === 'number' ? String(aiType) : String(aiType);
  const normalized = typeString.toLowerCase().trim();

  // Step 1: Check if it's a supported kind directly
  const supportedKinds = nlpTypesConfig.supportedKinds as string[];
  if (supportedKinds.includes(normalized)) {
    console.log('[dataBuilder][mapType] Direct match', {
      aiType,
      mappedKind: normalized
    });
    return normalized as Kind;
  }

  // Step 2: Check aliases mapping
  const aliases = nlpTypesConfig.aliases as Record<string, string>;
  if (aliases[normalized]) {
    console.log('[dataBuilder][mapType] Alias match', {
      aiType,
      alias: normalized,
      mappedKind: aliases[normalized]
    });
    return aliases[normalized] as Kind;
  }

  // Step 3: Fallback to 'generic' for unknown types
  console.log('[dataBuilder][mapType] Unknown type, using fallback', {
    aiType,
    normalized,
    mappedKind: 'generic',
    availableKinds: supportedKinds.join(', ')
  });

  return 'generic';
}

// Ricorsivo: struttura identica per data e subData.
export function builddataNode(
  ddtId: string,
  dataNode: any,
  stepMessages: Record<string, string[][]>,
  translations: Record<string, string>
) {
  return builddataNodeWithSubData(ddtId, dataNode, { data: stepMessages, subData: {} }, translations);
}

// Nuova funzione che supporta stepMessages specifici per subData
export function builddataNodeWithSubData(
  ddtId: string,
  dataNode: any,
  stepMessagesWithSubData: SubDataStepMessages,
  translations: Record<string, string>
) {
  console.log('[dataBuilder][builddataNodeWithSubData]', {
    ddtId,
    hasDataNode: !!dataNode,
    dataNodeKeys: dataNode ? Object.keys(dataNode) : [],
    label: dataNode?.label,
    name: dataNode?.name,
    variable: dataNode?.variable,
    type: dataNode?.type
  });

  // Normalize and enrich constraints, add prompt translations
  const constraints = enrichAndTranslateConstraints(Array.isArray(dataNode.constraints) ? dataNode.constraints : [], ddtId, translations);

  // Build steps using StepBuilder - use data stepMessages
  const STANDARD_STEPS: StepGroup['type'][] = ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
  let allStepTranslations: { key: string; value: string }[] = [];
  const steps: StepGroup[] = STANDARD_STEPS.map((stepType) => {
    const messagesArr = (stepMessagesWithSubData.data && stepMessagesWithSubData.data[stepType]) || [];
    // Always create a step, even if messagesArr is empty (for sub-data without specific prompts)
    // This ensures each node has its own step objects, not shared references
    const step = buildStepGroup(stepType, messagesArr, ddtId, translations);
    // Ensure escalations array exists even if empty
    if (!step.escalations || step.escalations.length === 0) {
      step.escalations = [];
    }
    return step;
  });

  // Recursively build subData with their specific stepMessages
  let subData = [];
  if (dataNode.subData && Array.isArray(dataNode.subData)) {
    subData = dataNode.subData.map((sub: any) => {
      // Always set label and id for subData
      sub.label = sub.label || sub.variable || sub.name || 'Subdata';
      sub.id = sub.id || uuidv4();

      // Get specific stepMessages for this subData
      const subDataName = (sub.name || sub.variable || sub.label || '').toLowerCase(); // Normalize to lowercase
      const subDataStepMessages = stepMessagesWithSubData.subData[subDataName] || {};

      // Create a SubDataStepMessages object for this subData
      const subDataStepMessagesObj: SubDataStepMessages = {
        data: subDataStepMessages, // Use subData-specific messages as data
        subData: {} // No nested subData for now
      };

      const result = builddataNodeWithSubData(ddtId, sub, subDataStepMessagesObj, translations);

      // ✅ CRITICAL: Preserve templateId if present in input
      if (sub.templateId) {
        result.templateId = sub.templateId;
      }

      return result;
    });
  }

  // Merge all translations
  for (const { key, value } of allStepTranslations) {
    translations[key] = value;
  }

  // Build data node
  const data: any = {
    constraints,
    steps,
    subData,
  };
  // Always set label, id, and icon for data
  data.label = dataNode.label || dataNode.variable || dataNode.name || 'Subdata';
  data.id = dataNode.id || uuidv4();
  if (dataNode.variable) data.variable = dataNode.variable;
  if (dataNode.icon) data.icon = dataNode.icon;  // ✅ Preserve icon from AI

  // ✅ CRITICAL: Preserve templateId if present in input
  if (dataNode.templateId) {
    data.templateId = dataNode.templateId;
  }

  // ✅ Map AI type → frontend Kind with fallback to 'generic'
  if (dataNode.type) {
    data.kind = mapAITypeToKind(dataNode.type);
  }

  console.log('[dataBuilder][result]', {
    ddtId,
    assignedLabel: data.label,
    assignedKind: data.kind,
    aiType: dataNode.type,
    usedFallback: data.label === 'Subdata',
    hadLabel: !!dataNode.label,
    hadVariable: !!dataNode.variable,
    hadName: !!dataNode.name,
    hadType: !!dataNode.type
  });

  // Final clean log for the full node (including subData)
  return data;
}