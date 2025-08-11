// Moved from orchestrator/assembleFinalDDT.ts for modular DDTAssembler structure.
import type { AssembledDDT, MainDataNode } from './currentDDT.types';
import { buildMainDataNodeWithSubData } from './MainDataBuilder';
import { StepResult } from '../orchestrator/types';
import { buildStepsWithSubData } from './buildStepMessagesFromResults';

// Entrypoint: costruisce il DDT completo e ricorsivo.
export function buildDDT(
  ddtId: string,
  dataNode: any,
  stepResults: StepResult[]
) : AssembledDDT {
  const stepMessagesWithSubData = buildStepsWithSubData(stepResults);
  const translations: Record<string, string> = {};
  const mainData: MainDataNode = buildMainDataNodeWithSubData(
    ddtId,
    dataNode,
    stepMessagesWithSubData,
    translations
  ) as MainDataNode;
  const label = dataNode.label || ddtId;
  const assembledDDT: AssembledDDT = {
    id: ddtId,
    label,
    mainData,
    translations
  };
  console.log('[DDTAssembler] Assembled DDT JSON:', assembledDDT);
  return assembledDDT;
}