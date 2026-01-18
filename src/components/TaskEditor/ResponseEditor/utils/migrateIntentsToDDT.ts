/**
 * Migrazione: Converte task.intents in values[] nel DDT
 *
 * Questa funzione unifica la rappresentazione degli intenti:
 * - Prima: task.intents[] (array di ProblemIntent)
 * - Dopo: ddt.mainData[0].values[] (opzioni predefinite)
 *
 * IMPORTANTE: values[] sono opzioni predefinite (valori tra cui scegliere)
 * NON confondere con subData[] che sono parti composite (struttura del dato)
 *
 * Le training phrases per embeddings vengono salvate nel contract NLP.
 */

import type { ProblemIntent } from '../../../types/project';
import type { NLPContract } from '../../../components/DialogueDataEngine/contracts/contractLoader';

export interface MigrateIntentsResult {
  mainData: any[];
  contract?: NLPContract;
}

/**
 * Converte task.intents in values[] nel DDT
 *
 * @param intents - Array di ProblemIntent da task.intents
 * @param existingDDT - DDT esistente (opzionale, per preservare altri dati)
 * @returns DDT con mainData[0].values[] popolato dagli intenti
 */
export function migrateIntentsToDDT(
  intents: ProblemIntent[],
  existingDDT?: any
): MigrateIntentsResult {
  // ✅ Crea values[] dagli intenti (opzioni predefinite, NON subData[])
  const values = intents.map((intent) => ({
    id: intent.id,
    label: intent.name,
    value: intent.name, // ✅ Valore da usare nella condizione
  }));

  // ✅ Crea o aggiorna mainData[0]
  const mainData = existingDDT?.mainData || [];
  const firstMain = mainData[0] || {
    id: `main-${Date.now()}`,
    label: 'Seleziona opzione',
    kind: 'generic' as const, // ✅ Non più 'intent'
    steps: {
      ask: {
        base: 'Quale opzione preferisci?',
        reaskNoInput: [],
        reaskNoMatch: [],
      },
    },
  };

  // ✅ Aggiorna values del primo main (NON subData)
  firstMain.values = values;

  // ✅ Aggiorna mainData
  const updatedMainData = [firstMain, ...mainData.slice(1)];

  // ✅ Crea contract NLP con embeddings configurato
  // NOTA: subDataMapping è vuoto perché values[] non sono subData (parti composite)
  const contract: NLPContract = {
    templateName: 'intent-classifier',
    templateId: `intent-${Date.now()}`,
    subDataMapping: {}, // ✅ Vuoto: values[] non sono subData (parti composite)
    methods: {
      embeddings: {
        enabled: true,
        intents: intents.map((intent) => ({
          id: intent.id,
          name: intent.name,
          threshold: intent.threshold,
          variants: {
            curated: intent.phrases.matching || [],
            hardNeg: intent.phrases.notMatching || [],
            test: [], // ✅ Test phrases inizialmente vuote
          },
        })),
        modelReady: false,
      },
    },
    escalationOrder: ['embeddings'], // ✅ Default: solo embeddings per intenti
  };

  return {
    mainData: updatedMainData,
    contract,
  };
}

/**
 * Verifica se un task ha intents da migrare
 */
export function hasIntentsToMigrate(task: any): boolean {
  return !!(task?.intents && Array.isArray(task.intents) && task.intents.length > 0);
}
