import { Step, StepType } from './types';
import fetchStructure from './fetchStructure';
import enrichConstraints from './enrichConstraints';
import generateScripts from './generateScripts';
import batchMessages from './batchMessages';

// Backend base URL
const API_BASE = '';

// Tipo base per input
export interface DataNode {
  name: string;
  type?: string;
  label?: string;
  variable?: string;
  subData?: DataNode[]; // Corrected from subdata to subData
  constraints?: string[]; // nomi delle regole, per ora stub
}

// Genera la sequenza di step per un dato (e subdata)
export function generateSteps(data: DataNode): Step[] {
  return generateStepsSkipDetectType(data, false);
}

// Nuova funzione: permette di saltare detectType
export function generateStepsSkipDetectType(data: DataNode, skipDetectType: boolean): Step[] {
  // Definisci la sequenza degli step in modo esplicito
  const stepPlan: Array<{
    key: string;
    type: string;
    endpoint: string;
    label: string;
    payoff: string;
    subDataInfo?: DataNode;
    subDataIndex?: number;
  }> = [
    { key: 'detectType', type: 'detectType', endpoint: '/step2', label: 'Detecting data type...', payoff: 'Identifying the type of data.' },
    { key: 'suggestStructureAndConstraints', type: 'suggestStructureAndConstraints', endpoint: '/step3', label: 'Suggesting structure and constraints...', payoff: 'Suggesting data structure and validation rules.' },
    { key: 'startPrompt', type: 'startPrompt', endpoint: '/api/startPrompt', label: 'Start prompt...', payoff: 'Generating start message.' },
    { key: 'noMatchPrompts', type: 'noMatchPrompts', endpoint: '/api/stepNoMatch', label: 'No match prompts...', payoff: 'Prompts for unmatched input.' },
    { key: 'noInputPrompts', type: 'noInputPrompts', endpoint: '/api/stepNoInput', label: 'No input prompts...', payoff: 'Prompts for missing input.' },
    { key: 'confirmationPrompts', type: 'confirmationPrompts', endpoint: '/api/stepConfirmation', label: 'Confirmation prompts...', payoff: 'Prompts for user confirmation.' },
    { key: 'successPrompts', type: 'successPrompts', endpoint: '/api/stepSuccess', label: 'Success prompts...', payoff: 'Prompts for successful completion.' },
  ];

  // Add subData steps if subData exists - using same endpoints as mainData
  if (data.subData && data.subData.length > 0) {
    data.subData.forEach((subData, index) => {
      // Use label, variable, or name for the subData identifier
      const subDataName = subData.label || subData.variable || subData.name || `subData_${index}`;
      // console.log('[DEBUG] Creating steps for subData:', subDataName, 'with data:', subData);
      
      // Use the same endpoints as mainData for subData
      stepPlan.push(
        { 
          key: `subData_startPrompt_${subDataName}_${index}`, 
          type: 'startPrompt', 
          endpoint: '/api/startPrompt', 
          label: `Generating start prompt for ${subDataName}...`, 
          payoff: `Creating start prompt for ${subDataName} subfield.`,
          subDataInfo: subData,
          subDataIndex: index
        },
        { 
          key: `subData_noMatchPrompts_${subDataName}_${index}`, 
          type: 'noMatchPrompts', 
          endpoint: '/api/stepNoMatch', 
          label: `Generating no match prompts for ${subDataName}...`, 
          payoff: `Creating no match prompts for ${subDataName} subfield.`,
          subDataInfo: subData,
          subDataIndex: index
        },
        { 
          key: `subData_noInputPrompts_${subDataName}_${index}`, 
          type: 'noInputPrompts', 
          endpoint: '/api/stepNoInput', 
          label: `Generating no input prompts for ${subDataName}...`, 
          payoff: `Creating no input prompts for ${subDataName} subfield.`,
          subDataInfo: subData,
          subDataIndex: index
        },
        { 
          key: `subData_confirmationPrompts_${subDataName}_${index}`, 
          type: 'confirmationPrompts', 
          endpoint: '/api/stepConfirmation', 
          label: `Generating confirmation prompts for ${subDataName}...`, 
          payoff: `Creating confirmation prompts for ${subDataName} subfield.`,
          subDataInfo: subData,
          subDataIndex: index
        },
        { 
          key: `subData_successPrompts_${subDataName}_${index}`, 
          type: 'successPrompts', 
          endpoint: '/api/stepSuccess', 
          label: `Generating success prompts for ${subDataName}...`, 
          payoff: `Creating success prompts for ${subDataName} subfield.`,
          subDataInfo: subData,
          subDataIndex: index
        }
      );
    });
  }

  function makePromptStep(stepDef: { key: string; type: StepType; endpoint: string; label: string; payoff: string; subDataInfo?: DataNode; subDataIndex?: number }, data: DataNode, extraBody: Record<string, any> = {}): Step {
      return {
      key: stepDef.key,
      label: stepDef.label,
      payoff: stepDef.payoff,
      type: stepDef.type,
      run: async () => {
          let body: any;
          if (stepDef.key === 'detectType') {
          body = JSON.stringify(data.name); // stringa pura
                      } else if (stepDef.subDataInfo) {
            // For subData, use main and sub labels explicitly, no hardcoded fallbacks
            const mainDataName = data.label || data.name || '';
            const subDataName = stepDef.subDataInfo.label || stepDef.subDataInfo.name || '';
            body = JSON.stringify({
                meaning: subDataName || mainDataName,
                desc: `Generate a concise, direct message for ${subDataName || mainDataName}.`,
                ...extraBody
            });
          } else {
            body = JSON.stringify({ meaning: data.label || data.name || '', desc: '', ...extraBody });
          }
          try {
          const res = await fetch(`${stepDef.endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
          });
          const result = await res.json();
          
          // Handle different response structures
          let payload;
          // For all steps, use result.ai
          payload = result.ai;
          
          return { stepKey: stepDef.key, payload: payload };
          } catch (err) {
          throw err;
          }
      },
      };
  }

  const steps: Step[] = [];
  for (const stepDef of stepPlan) {
    if (skipDetectType && stepDef.key === 'detectType') continue;
    steps.push(makePromptStep({ ...stepDef, type: stepDef.type as StepType }, data));
  }
  return steps;
} 
