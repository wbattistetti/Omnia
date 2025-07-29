import { StepResult } from './types';
import { v4 as uuidv4 } from 'uuid';
import { assembleFinalDDT as assembleFinalDDTNew } from './assembleFinalDDT';

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

// Utility per generare la runtimeKey
function makeRuntimeKey(ddtId: string, step: string, escalationIdx: number, actionInstanceId: string) {
  return `runtime.${ddtId}.${step}#${escalationIdx}.${actionInstanceId}.text`;
}

// Funzione di assemblaggio finale
export function assembleFinalDDT(stepResults: StepResult[]): { structure: any, translations: Record<string, string> } {
  // --- Estrai i dati necessari dagli stepResults ---
  let ddtId = 'ddt_' + Math.random().toString(36).slice(2);
  let mainData: any = {};
  let stepMessages: Record<string, string[][]> = {};
  let translations: Record<string, string> = {};

  // 1. Trova il tipo/nome (detectType)
  for (const result of stepResults) {
    if (result.stepKey === 'detectType' && result.payload && result.payload.type) {
      ddtId = 'ddt_' + (result.payload.type.replace(/\s+/g, '').toLowerCase() || Math.random().toString(36).slice(2));
    }
  }
  // 2. Trova la struttura mainData e subData (di solito in suggestStructureAndConstraints)
  for (const result of stepResults) {
    if (result.stepKey === 'suggestStructureAndConstraints' && result.payload) {
      mainData = result.payload.mainData || result.payload;
      // Se ci sono subData, assicurati che siano in mainData.subData
      if (result.payload.subData && !mainData.subData) {
        mainData.subData = result.payload.subData;
      }
      // Patch: valorizza almeno variable e label se mancano
      if (!mainData.variable) mainData.variable = result.payload.type || result.payload.name || 'Main data';
      if (!mainData.label) mainData.label = result.payload.type || result.payload.name || 'Main data';
    }
  }
  // 3. Raccogli i messaggi per step (startPrompt, noMatchPrompts, ecc.)
  for (const result of stepResults) {
    if (result.stepKey.endsWith('Prompts')) {
      const step = result.stepKey.replace('Prompts', '');
      const messages = Array.isArray(result.payload) ? result.payload : result.payload.messages || result.payload;
      if (!stepMessages[step]) stepMessages[step] = [];
      // Ogni chiamata è una escalation (per ora, semplificato)
      if (Array.isArray(messages)) stepMessages[step].push(messages);
    }
  }
  // 4. Constraints, label, ecc. sono già in mainData (se la pipeline è coerente)
  // 5. Chiama la nuova funzione ricorsiva
  const ddt = assembleFinalDDTNew(ddtId, mainData, stepMessages, translations, stepResults);
  // 6. Log per debug
  console.log('[assembleFinalDDT] DDT finale (nuova):', ddt);
  console.log('[assembleFinalDDT] DDT finale (JSON):\n' + JSON.stringify(ddt, null, 2));
  return { structure: ddt, translations: ddt.translations };
} 