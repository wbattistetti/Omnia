/**
 * Migrazione: Converte task.intents in values[] nel TaskTree
 *
 * Questa funzione unifica la rappresentazione degli intenti:
 * - Prima: task.intents[] (array di ProblemIntent)
 * - Dopo: taskTree.nodes[0].values[] (opzioni predefinite)
 *
 * IMPORTANTE: values[] sono opzioni predefinite (valori tra cui scegliere)
 * NON confondere con subNodes[] che sono parti composite (struttura del dato)
 *
 * Le training phrases per embeddings vengono salvate nel contract NLP.
 */

import type { ProblemIntent } from '../../../types/project';
import type { NLPContract } from '../../../components/DialogueDataEngine/contracts/contractLoader';

export interface MigrateIntentsResult {
  nodes: any[];
  contract?: NLPContract;
}

/**
 * Converte task.intents in values[] nel TaskTree
 *
 * @param intents - Array di ProblemIntent da task.intents
 * @param existingTaskTree - TaskTree esistente (opzionale, per preservare altri dati)
 * @returns TaskTree con nodes[0].values[] popolato dagli intenti
 */
export function migrateIntentsToDDT(
  intents: ProblemIntent[],
  existingTaskTree?: any
): MigrateIntentsResult {
  // ✅ Crea values[] dagli intenti (opzioni predefinite, NON subNodes[])
  const values = intents.map((intent) => ({
    id: intent.id,
    label: intent.name,
    value: intent.name, // ✅ Valore da usare nella condizione
  }));

  // ✅ NUOVO MODELLO: Usa nodes[] invece di data[]
  const nodes = existingTaskTree?.nodes || [];
  const firstMain = nodes[0] || {
    id: `main-${Date.now()}`,
    templateId: `main-${Date.now()}`,
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

  // ✅ Aggiorna values del primo main (NON subNodes)
  firstMain.values = values;

  // ✅ Aggiorna nodes
  const updatedNodes = [firstMain, ...nodes.slice(1)];

  // ✅ Crea contract NLP con embeddings configurato
  // NOTA: subDataMapping è vuoto perché values[] non sono subNodes (parti composite)
  const contract: NLPContract = {
    templateName: 'intent-classifier',
    templateId: `intent-${Date.now()}`,
    subDataMapping: {}, // ✅ Vuoto: values[] non sono subNodes (parti composite)
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
    nodes: updatedNodes,
    contract,
  };
}

/**
 * Verifica se un task ha intents da migrare
 */
export function hasIntentsToMigrate(task: any): boolean {
  return !!(task?.intents && Array.isArray(task.intents) && task.intents.length > 0);
}
