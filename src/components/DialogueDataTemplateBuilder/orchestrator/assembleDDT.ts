import { StepResult } from './types';

// Tipo base per output DDT
export interface DDTNode {
  id: string;
  name: string;
  type?: string;
  prompts?: Record<string, string>;
  validationRules?: any[];
  constraints?: any[];
  steps?: any[];
  subdata?: DDTNode[];
}

// Funzione di assemblaggio finale (stub, da completare con mapping reale)
export function assembleFinalDDT(stepResults: StepResult[]): DDTNode {
  // Esempio: estrai nome e prompts dai risultati
  const ddt: DDTNode = {
    id: 'ddt_' + Math.random().toString(36).slice(2),
    name: 'TODO',
    prompts: {},
    validationRules: [],
    constraints: [],
    steps: [],
    subdata: [],
  };

  for (const result of stepResults) {
    // Qui va la logica di mapping stepKey -> campo DDTNode
    // Esempio: prompts, validationRules, ecc
    if (
      result.stepKey.endsWith('Prompts') &&
      typeof result.payload === 'object' &&
      result.payload !== null &&
      !Array.isArray(result.payload)
    ) {
      if (!ddt.prompts) ddt.prompts = {};
      Object.assign(ddt.prompts, result.payload as Record<string, string>);
    }
    // TODO: mapping per validationRules, constraints, subdata, ecc
  }

  return ddt;
} 