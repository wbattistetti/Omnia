// Tipi condivisi per ConstraintGenerator

export interface ConstraintTestCase {
  input: any; // valore di test (string, number, date, ecc.)
  expected: boolean; // true se deve passare la validazione
  description: string; // breve descrizione del caso
}

export interface Constraint {
  id: string;
  title: string;
  script: string; // espressione JS
  explanation: string; // spiegazione naturale
  messages: string[]; // messaggi di errore/escalation
  testCases: ConstraintTestCase[];
  variable: string; // nome variabile DDT
  type: string; // tipo dato (es: date, number, string)
} 