/**
 * ddtStepGenerator.ts - Modulo per generare tutti gli steps da AI (standalone)
 *
 * Usato quando non c'è un template candidato e dobbiamo generare tutto da zero.
 */

import { generateStepsSkipDetectType } from '../components/DialogueDataTemplateBuilder/orchestrator/stepGenerator';
import { buildDDT } from '../components/DialogueDataTemplateBuilder/DDTAssembler/DDTBuilder';
import type { SchemaNode } from '../components/DialogueDataTemplateBuilder/DDTWizard/types';
import type { Step, StepResult } from '../components/DialogueDataTemplateBuilder/orchestrator/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converte SchemaNode in DataNode per l'orchestrator
 */
function schemaNodeToDataNode(node: SchemaNode): any {
  return {
    name: node.label || '',
    label: node.label || '',
    type: node.type || 'text',
    variable: (node as any).variable,
    subData: node.subData?.map(schemaNodeToDataNode) || [],
    constraints: node.constraints || [],
    icon: (node as any).icon,
    nlpContract: (node as any).nlpContract,
    templateId: (node as any).templateId,
    kind: (node as any).kind
  };
}

/**
 * Esegue un singolo step
 */
async function runStep(step: Step): Promise<StepResult> {
  try {
    const payload = await step.run();
    return {
      stepKey: step.key,
      payload,
      translations: (payload as any).translations || {}
    };
  } catch (error) {
    console.error(`[ddtStepGenerator] Error running step ${step.key}:`, error);
    throw error;
  }
}

/**
 * Genera tutti gli steps per una struttura dati usando AI
 *
 * @param dataTree - Struttura dati (array di SchemaNode)
 * @param rootLabel - Label principale (es. "Date")
 * @param contextLabel - Label contestuale (es. "Chiedi la data di nascita del paziente")
 * @param provider - AI provider ('groq' | 'openai')
 * @param onProgress - Callback opzionale per progresso
 * @returns DDT completo con tutti gli steps generati
 */
export async function generateAllStepsFromAI(
  dataTree: SchemaNode[],
  rootLabel: string,
  contextLabel: string,
  provider: 'groq' | 'openai' = 'groq',
  onProgress?: (current: number, total: number, stepLabel: string) => void
): Promise<any> {
  console.log('[🔍 ddtStepGenerator] generateAllStepsFromAI START', {
    dataTreeLength: dataTree.length,
    rootLabel,
    contextLabel,
    provider,
    mainNodes: dataTree.map((n: any) => ({ label: n.label, type: n.type, subDataCount: n.subData?.length || 0 }))
  });

  if (!dataTree || dataTree.length === 0) {
    throw new Error('[ddtStepGenerator] dataTree è obbligatorio e deve essere un array non vuoto');
  }

  // Converti SchemaNode[] in DataNode per l'orchestrator
  // Assumiamo che il primo main node sia quello principale
  const mainDataNode = schemaNodeToDataNode(dataTree[0]);

  // Genera tutti gli step da eseguire
  const steps = generateStepsSkipDetectType(mainDataNode, true, provider, contextLabel);
  console.log('[🔍 ddtStepGenerator] Steps generati', {
    stepsCount: steps.length,
    stepKeys: steps.map(s => s.key),
    stepTypes: steps.map(s => s.type)
  });

  // Esegui tutti gli step sequenzialmente
  const stepResults: StepResult[] = [];
  let currentStep = 0;

  for (const step of steps) {
    currentStep++;
    const stepLabel = step.label || step.key;

    if (onProgress) {
      onProgress(currentStep, steps.length, stepLabel);
    }

    console.log(`[🔍 ddtStepGenerator] Eseguendo step ${currentStep}/${steps.length}`, {
      stepKey: step.key,
      stepType: step.type,
      stepLabel: stepLabel
    });

    try {
      const result = await runStep(step);
      stepResults.push(result);

      console.log(`[🔍 ddtStepGenerator] Step ${currentStep}/${steps.length} completato`, {
        stepKey: step.key,
        hasPayload: !!result.payload,
        hasTranslations: !!result.translations && Object.keys(result.translations).length > 0
      });

      // Se questo è suggestStructureAndConstraints, aggiorna la struttura
      if (step.key === 'suggestStructureAndConstraints' && result.payload?.data) {
        // La struttura è già stata aggiornata, continua
        console.log('[🔍 ddtStepGenerator] Struttura aggiornata da suggestStructureAndConstraints');
      }
    } catch (error) {
      console.error(`[🔍 ddtStepGenerator] ❌ Errore nello step ${step.key}:`, error);
      throw error;
    }
  }

  console.log('[🔍 ddtStepGenerator] Tutti gli step completati', {
    resultsCount: stepResults.length,
    totalSteps: steps.length
  });

  // Costruisci il DDT finale usando buildDDT
  // buildDDT prende: ddtId, inputDataNode (singolo nodo), stepResults (array di StepResult)
  const ddtId = uuidv4();
  const finalDDT = buildDDT(
    ddtId,
    mainDataNode, // Singolo nodo principale, non array
    stepResults // Array di StepResult
  );

  console.log('[🔍 ddtStepGenerator] generateAllStepsFromAI COMPLETE', {
    ddtId: finalDDT.id,
    ddtLabel: finalDDT.label,
    dataLength: finalDDT.data?.length || 0,
    hasSteps: !!finalDDT.steps,
    stepsCount: finalDDT.steps ? Object.keys(finalDDT.steps).length : 0
  });

  return finalDDT;
}
