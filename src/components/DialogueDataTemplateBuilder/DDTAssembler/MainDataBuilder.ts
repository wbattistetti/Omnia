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
 * @param aiType - The type returned by the AI (e.g., 'phone', 'taxCode', 'fiscalCode')
 * @returns The corresponding frontend Kind or 'generic' as fallback
 */
function mapAITypeToKind(aiType: string | undefined): Kind | undefined {
  if (!aiType) return undefined;
  
  const normalized = aiType.toLowerCase().trim();
  
  // Step 1: Check if it's a supported kind directly
  const supportedKinds = nlpTypesConfig.supportedKinds as string[];
  if (supportedKinds.includes(normalized)) {
    console.log('[MainDataBuilder][mapType] Direct match', {
      aiType,
      mappedKind: normalized
    });
    return normalized as Kind;
  }
  
  // Step 2: Check aliases mapping
  const aliases = nlpTypesConfig.aliases as Record<string, string>;
  if (aliases[normalized]) {
    console.log('[MainDataBuilder][mapType] Alias match', {
      aiType,
      alias: normalized,
      mappedKind: aliases[normalized]
    });
    return aliases[normalized] as Kind;
  }
  
  // Step 3: Fallback to 'generic' for unknown types
  console.log('[MainDataBuilder][mapType] Unknown type, using fallback', {
    aiType,
    normalized,
    mappedKind: 'generic',
    availableKinds: supportedKinds.join(', ')
  });
  
  return 'generic';
}

// Ricorsivo: struttura identica per mainData e subData.
export function buildMainDataNode(
  ddtId: string,
  dataNode: any,
  stepMessages: Record<string, string[][]>,
  translations: Record<string, string>
) {
  return buildMainDataNodeWithSubData(ddtId, dataNode, { mainData: stepMessages, subData: {} }, translations);
}

// Nuova funzione che supporta stepMessages specifici per subData
export function buildMainDataNodeWithSubData(
  ddtId: string,
  dataNode: any,
  stepMessagesWithSubData: SubDataStepMessages,
  translations: Record<string, string>
) {
  console.log('[MainDataBuilder][buildMainDataNodeWithSubData]', {
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

  // Build steps using StepBuilder - use mainData stepMessages
  const STANDARD_STEPS: StepGroup['type'][] = ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
  let allStepTranslations: { key: string; value: string }[] = [];
  const steps: StepGroup[] = STANDARD_STEPS.map((stepType) => {
    const messagesArr = (stepMessagesWithSubData.mainData && stepMessagesWithSubData.mainData[stepType]) || [];
    const step = buildStepGroup(stepType, messagesArr, ddtId, translations);
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
        mainData: subDataStepMessages, // Use subData-specific messages as mainData
        subData: {} // No nested subData for now
      };
      
      const result = buildMainDataNodeWithSubData(ddtId, sub, subDataStepMessagesObj, translations);
      return result;
    });
  }

  // Merge all translations
  for (const { key, value } of allStepTranslations) {
    translations[key] = value;
  }

  // Build mainData node
  const mainData: any = {
    constraints,
    steps,
    subData,
  };
  // Always set label, id, and icon for mainData
  mainData.label = dataNode.label || dataNode.variable || dataNode.name || 'Subdata';
  mainData.id = dataNode.id || uuidv4();
  if (dataNode.variable) mainData.variable = dataNode.variable;
  if (dataNode.icon) mainData.icon = dataNode.icon;  // ✅ Preserve icon from AI
  
  // ✅ Map AI type → frontend Kind with fallback to 'generic'
  if (dataNode.type) {
    mainData.kind = mapAITypeToKind(dataNode.type);
  }
  
  console.log('[MainDataBuilder][result]', {
    ddtId,
    assignedLabel: mainData.label,
    assignedKind: mainData.kind,
    aiType: dataNode.type,
    usedFallback: mainData.label === 'Subdata',
    hadLabel: !!dataNode.label,
    hadVariable: !!dataNode.variable,
    hadName: !!dataNode.name,
    hadType: !!dataNode.type
  });
  
  // Final clean log for the full node (including subData)
  return mainData;
}