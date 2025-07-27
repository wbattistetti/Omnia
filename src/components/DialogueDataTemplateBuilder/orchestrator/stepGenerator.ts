import { Step, StepType } from './types';
import fetchStructure from './fetchStructure';
import enrichConstraints from './enrichConstraints';
import generateScripts from './generateScripts';
import batchMessages from './batchMessages';

// Tipo base per input
export interface DataNode {
  name: string;
  subdata?: DataNode[];
  constraints?: string[]; // nomi delle regole, per ora stub
}

// Genera la sequenza di step per un dato (e subdata)
export function generateSteps(data: DataNode): Step[] {
  const steps: Step[] = [];

  // Step fissi
  steps.push({
    key: 'detectType',
    label: 'Detecting data type...',
    payoff: 'Identifying the type of data.',
    type: 'detectType',
    run: async () => ({ stepKey: 'detectType', payload: null }),
  });
  steps.push({
    key: `createFor_${data.name}`,
    label: `Creating for ${data.name}`,
    payoff: `Generating prompts and rules for ${data.name}.`,
    type: 'createFor',
    run: async () => {
      // Fetch struttura reale
      const result = await fetchStructure(data.name);
      return { stepKey: `createFor_${data.name}`, payload: result };
    },
  });
  steps.push({
    key: 'startPrompts',
    label: 'Start prompts...',
    payoff: 'Generating initial user prompts.',
    type: 'startPrompts',
    run: async () => ({ stepKey: 'startPrompts', payload: null }),
  });
  steps.push({
    key: 'noMatchPrompts',
    label: 'No match prompts...',
    payoff: 'Prompts for unmatched input.',
    type: 'noMatchPrompts',
    run: async () => ({ stepKey: 'noMatchPrompts', payload: null }),
  });
  steps.push({
    key: 'noInputPrompts',
    label: 'No input prompts...',
    payoff: 'Prompts for missing input.',
    type: 'noInputPrompts',
    run: async () => ({ stepKey: 'noInputPrompts', payload: null }),
  });
  steps.push({
    key: 'confirmationPrompts',
    label: 'Confirmation prompts...',
    payoff: 'Prompts for user confirmation.',
    type: 'confirmationPrompts',
    run: async () => ({ stepKey: 'confirmationPrompts', payload: null }),
  });
  steps.push({
    key: 'successPrompts',
    label: 'Success prompts...',
    payoff: 'Prompts for successful completion.',
    type: 'successPrompts',
    run: async () => ({ stepKey: 'successPrompts', payload: null }),
  });
  steps.push({
    key: 'validationRules',
    label: 'Validation rules...',
    payoff: `Suggesting validation rules for ${data.name}.`,
    type: 'validationRules',
    run: async () => {
      // Enrich constraints reale
      const enriched = await enrichConstraints(data);
      return { stepKey: 'validationRules', payload: enriched };
    },
  });

  // Step dinamici per constraints (stub: in reale, dopo fetch IA)
  if (data.constraints) {
    for (const rule of data.constraints) {
      steps.push({
        key: `${rule}_Script`,
        label: `${rule} Script`,
        payoff: `Generating validation script for ${rule}.`,
        type: 'constraintScript',
        constraintIdeId: rule,
        run: async () => {
          // Generate scripts reale
          const scripts = await generateScripts(data); // data qui è il nodo corrente
          return { stepKey: `${rule}_Script`, payload: scripts };
        },
      });
      steps.push({
        key: `${rule}_TestSet`,
        label: `${rule} Test set`,
        payoff: `Generating test set for ${rule}.`,
        type: 'constraintTestSet',
        constraintIdeId: rule,
        run: async () => ({ stepKey: `${rule}_TestSet`, payload: null }),
      });
      steps.push({
        key: `${rule}_Messages`,
        label: `${rule} Messages`,
        payoff: `Generating user messages for ${rule}.`,
        type: 'constraintMessages',
        constraintIdeId: rule,
        run: async () => {
          // Batch messages reale
          const messages = await batchMessages([rule]);
          return { stepKey: `${rule}_Messages`, payload: messages };
        },
      });
    }
  }

  // Ricorsione per subdata
  if (data.subdata) {
    for (const sub of data.subdata) {
      steps.push(...generateSteps(sub));
    }
  }

  return steps;
} 