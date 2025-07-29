// Moved from orchestrator/assembleFinalDDT.ts for modular DDTAssembler structure.
import { v4 as uuidv4 } from 'uuid';
import { buildStepGroup } from './StepBuilder';
import { StepGroup, Escalation, Action, KNOWN_ACTIONS } from './types';
import { buildMainDataNode } from './MainDataBuilder';
import { StepResult } from '../orchestrator/types';
import { buildStepMessagesFromResults } from './buildStepMessagesFromResults';

// Entrypoint: costruisce il DDT completo e ricorsivo.
export function buildDDT(
  ddtId: string,
  dataNode: any,
  stepResults: StepResult[]
) {
  const stepMessages = buildStepMessagesFromResults(stepResults);
  const translations: Record<string, string> = {};
  const mainData = buildMainDataNode(ddtId, dataNode, stepMessages, translations);
  const label = dataNode.label || ddtId;
  return {
    id: ddtId,
    label,
    mainData,
    translations
  };
}