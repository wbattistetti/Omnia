import { buildStepGroup } from './StepBuilder';
import { StepGroup } from './types';
import { enrichAndTranslateConstraints } from './ConstraintBuilder';
import { v4 as uuidv4 } from 'uuid';
import { buildStepsWithSubData, SubDataStepMessages } from './buildStepMessagesFromResults';

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
  // Normalize and enrich constraints, add prompt translations
  const constraints = enrichAndTranslateConstraints(Array.isArray(dataNode.constraints) ? dataNode.constraints : [], ddtId, translations);

  // Build steps using StepBuilder - use mainData stepMessages
  const STANDARD_STEPS: StepGroup['type'][] = ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
  let allStepTranslations: { key: string; value: string }[] = [];
  const steps: StepGroup[] = STANDARD_STEPS.map((stepType) => {
    const messagesArr = (stepMessagesWithSubData.mainData && stepMessagesWithSubData.mainData[stepType]) || [];
    console.log('[DEBUG] buildStepGroup for', stepType, 'with messagesArr:', messagesArr);
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
  // Always set label and id for mainData
  mainData.label = dataNode.label || dataNode.variable || dataNode.name || 'Subdata';
  mainData.id = dataNode.id || uuidv4();
  if (dataNode.variable) mainData.variable = dataNode.variable;
  // Final clean log for the full node (including subData)
  console.log('[DDTAssembler] mainData node (final):', JSON.stringify(mainData, null, 2));
  return mainData;
}