import { Step, StepType } from './types';
import fetchStructure from './fetchStructure';
import enrichConstraints from './enrichConstraints';
import generateScripts from './generateScripts';
import batchMessages from './batchMessages';

// Tipo base per input
export interface DataNode {
  name: string;
  type?: string;
  subdata?: DataNode[];
  constraints?: string[]; // nomi delle regole, per ora stub
}

// Genera la sequenza di step per un dato (e subdata)
export function generateSteps(data: DataNode): Step[] {
  return generateStepsSkipDetectType(data, false);
}

// Nuova funzione: permette di saltare detectType
export function generateStepsSkipDetectType(data: DataNode, skipDetectType: boolean): Step[] {
  // Definisci la sequenza degli step in modo esplicito
  const stepPlan = [
    { key: 'detectType', type: 'detectType', endpoint: '/step2', label: 'Detecting data type...', payoff: 'Identifying the type of data.' },
    { key: 'suggestStructureAndConstraints', type: 'suggestStructureAndConstraints', endpoint: '/step3', label: 'Suggesting structure and constraints...', payoff: 'Suggesting data structure and validation rules.' },
    { key: 'startPrompt', type: 'startPrompt', endpoint: '/api/startPrompt', label: 'Start prompt...', payoff: 'Generating start message.' },
    { key: 'noMatchPrompts', type: 'noMatchPrompts', endpoint: '/api/stepNoMatch', label: 'No match prompts...', payoff: 'Prompts for unmatched input.' },
    { key: 'noInputPrompts', type: 'noInputPrompts', endpoint: '/api/stepNoInput', label: 'No input prompts...', payoff: 'Prompts for missing input.' },
    { key: 'confirmationPrompts', type: 'confirmationPrompts', endpoint: '/api/stepConfirmation', label: 'Confirmation prompts...', payoff: 'Prompts for user confirmation.' },
    { key: 'successPrompts', type: 'successPrompts', endpoint: '/api/stepSuccess', label: 'Success prompts...', payoff: 'Prompts for successful completion.' },
  ];

  function makePromptStep(stepDef: { key: string; type: StepType; endpoint: string; label: string; payoff: string }, data: DataNode, extraBody: Record<string, any> = {}): Step {
    // LOG: quante volte viene chiamato uno step e con quali dati
    console.log('[stepGenerator] makePromptStep INIT:', stepDef.key, 'data.name:', data.name);
    return {
      key: stepDef.key,
      label: stepDef.label,
      payoff: stepDef.payoff,
      type: stepDef.type,
      run: async () => {
        let body: any;
        if (stepDef.key === 'detectType') {
          body = JSON.stringify(data.name); // stringa pura
        } else {
          body = JSON.stringify({ meaning: data.name, desc: '', ...extraBody });
        }
        // Log dettagliato prima della fetch
        if (stepDef.key === 'startPrompt') {
          console.log('[stepGenerator][startPrompt] PRE-FETCH', { endpoint: stepDef.endpoint, body });
        }
        console.log(`[stepGenerator] makePromptStep: step=${stepDef.key}, endpoint=${stepDef.endpoint}, body=`, body);
        try {
          if (stepDef.key === 'startPrompt') {
            console.log('[stepGenerator][startPrompt] FETCH INIZIO', { endpoint: stepDef.endpoint });
          }
          const res = await fetch(stepDef.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
          });
          if (stepDef.key === 'startPrompt') {
            console.log('[stepGenerator][startPrompt] FETCH FATTA, status:', res.status);
          }
          // Log dopo la fetch ma prima del parsing
          console.log(`[stepGenerator] FETCH: step=${stepDef.key}, endpoint=${stepDef.endpoint}, status=${res.status}`);
          const result = await res.json();
          if (stepDef.key === 'startPrompt') {
            console.log('[stepGenerator][startPrompt] RESPONSE PARSED', result);
          }
          // Log della risposta
          console.log(`[stepGenerator] RESPONSE: step=${stepDef.key}, result=`, result);
          return { stepKey: stepDef.key, payload: result.ai };
        } catch (err) {
          // Log di errore
          if (stepDef.key === 'startPrompt') {
            console.error('[stepGenerator][startPrompt] ERROR', err);
          }
          console.error(`[stepGenerator] ERROR: step=${stepDef.key}`, err);
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