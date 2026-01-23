// Moved from orchestrator/assembleFinalDDT.ts for modular DDTAssembler structure.
import type { AssembledDDT, dataNode } from './currentDDT.types';
import { builddataNodeWithSubData } from './MainDataBuilder';
import { StepResult } from '../orchestrator/types';
import { buildStepsWithSubData } from './buildStepMessagesFromResults';

// Entrypoint: costruisce il DDT completo e ricorsivo.
export function buildDDT(
  ddtId: string,
  inputDataNode: any,
  stepResults: StepResult[]
) : AssembledDDT {
  const stepMessagesWithSubData = buildStepsWithSubData(stepResults);
  const translations: Record<string, string> = {};
  const dataNode: dataNode = builddataNodeWithSubData(
    ddtId,
    inputDataNode,
    stepMessagesWithSubData,
    translations
  ) as dataNode;
  const label = dataNode.label || ddtId;

  // Wrap dataNode in array - DDT expects data: dataNode[]
  const assembledDDT: AssembledDDT = {
    id: ddtId,
    label,
    data: [dataNode],  // ← Array wrapper!
    translations
  };
  console.log('[DDTAssembler] Assembled DDT JSON:', assembledDDT);
  return assembledDDT;
}