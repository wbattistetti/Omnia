// Moved from orchestrator/assembleFinalDDT.ts for modular DDTAssembler structure.
import { v4 as uuidv4 } from 'uuid';
import { buildStepGroup } from './StepBuilder';
import { StepGroup, Escalation, Action, KNOWN_ACTIONS } from './types';
import { buildMainDataNodeWithSubData } from './MainDataBuilder';
import { StepResult } from '../orchestrator/types';
import { buildStepsWithSubData } from './buildStepMessagesFromResults';

// Entrypoint: costruisce il DDT completo e ricorsivo.
export function buildDDT(
  ddtId: string,
  dataNode: any,
  stepResults: StepResult[]
) {
  const stepMessagesWithSubData = buildStepsWithSubData(stepResults);
  const translations: Record<string, string> = {};
  const mainData = buildMainDataNodeWithSubData(ddtId, dataNode, stepMessagesWithSubData, translations);
  const label = dataNode.label || ddtId;
  const assembledDDT = {
    id: ddtId,
    label,
    mainData,
    translations
  };
  console.log('[DDTAssembler] Assembled DDT JSON:', assembledDDT);
  return assembledDDT;
}