// Funzione per generare runtimeKey per ogni messaggio in una struttura DDT/constraint
// Restituisce un oggetto flat { runtimeKey: testo } per tutti i messaggi generabili
// Adatta la logica di naming alle regole del prompt AI (es. runtime.DDT_<ID>.<step>#<index>.<action>.text)

import { DataField, Constraint } from './assignGuidsToConstraints';

export type MessageMap = Record<string, string>;

interface GenerateRuntimeKeysOptions {
  ddtId: string;
  steps?: string[]; // es: ['start', 'noMatch', 'noInput', 'confirmation', 'success']
  constraintMessageCount?: number; // default 2
  stepMessageCount?: Record<string, number>; // es: { noMatch: 3, noInput: 3, confirmation: 2, start: 1, success: 1 }
}

export function generateRuntimeKeys(
  field: DataField,
  options: GenerateRuntimeKeysOptions,
  parentPath: string[] = []
): MessageMap {
  const {
    ddtId,
    steps = ['start', 'noMatch', 'noInput', 'confirmation', 'success'],
    constraintMessageCount = 2,
    stepMessageCount = { start: 1, success: 1, noMatch: 3, noInput: 3, confirmation: 2 },
  } = options;

  const messages: MessageMap = {};

  // Messaggi per step principali
  for (const step of steps) {
    const count = stepMessageCount[step] || 1;
    for (let i = 1; i <= count; i++) {
      const key = `runtime.DDT_${ddtId}.${step}#${i}.SayMessage_${i}.text`;
      messages[key] = '';
    }
  }

  // Messaggi per constraint
  for (const constraint of field.constraints || []) {
    for (let i = 1; i <= constraintMessageCount; i++) {
      const key = `runtime.DDT_${ddtId}.${constraint.type}#${i}.SayMessage_${constraint.id || i}.text`;
      messages[key] = '';
    }
  }

  // Ricorsione su subData
  for (const sub of field.subData || []) {
    Object.assign(messages, generateRuntimeKeys(sub, options, [...parentPath, sub.name]));
  }

  return messages;
}

/*
Esempio d'uso:

import { generateRuntimeKeys } from './generateRuntimeKeys';
import { assignGuidsToConstraints, DataField } from './assignGuidsToConstraints';

const myDataField: DataField = ... // struttura già con id
const ddtId = myDataField.id || 'Birthdate';
const messages = generateRuntimeKeys(myDataField, { ddtId });
console.log(Object.keys(messages)); // lista di tutte le runtimeKey generabili
*/ 