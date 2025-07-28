// Funzione robusta per assegnare GUID ricorsivi a tutti i constraint (e opzionalmente ai campi) in una struttura DataField/DDT
// Usa crypto.randomUUID() se disponibile, altrimenti fallback

export type Constraint = {
  id?: string;
  type: string;
  label: string;
  description: string;
  payoff?: string;
  accepted?: boolean;
  scripts?: Record<string, string>;
  messages?: Record<string, { en: string; it?: string }>;
  tests?: Array<{ input: any; expected: any; description: string }>;
};

export type DataField = {
  id?: string;
  name: string;
  label: string;
  type: string;
  constraints: Constraint[];
  subData?: DataField[];
};

function generateGUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function assignGuidsToConstraints(field: DataField): DataField {
  const assign = (f: DataField): DataField => ({
    ...f,
    id: f.id || generateGUID(),
    constraints: (f.constraints || []).map((c) => ({
      ...c,
      id: c.id || generateGUID(),
    })),
    subData: (f.subData || []).map(assign),
  });
  return assign(field);
}

/*
Esempio d'uso:

import { assignGuidsToConstraints, DataField } from './assignGuidsToConstraints';

const myDataField: DataField = {
  name: 'birthdate',
  label: 'Date of Birth',
  type: 'object',
  constraints: [
    { type: 'required', label: 'Required', description: '...' }
  ],
  subData: [
    {
      name: 'day', label: 'Day', type: 'number', constraints: []
    }
  ]
};

const enriched = assignGuidsToConstraints(myDataField);
console.log(enriched.constraints[0].id); // GUID
console.log(enriched.subData[0].id); // GUID
*/ 