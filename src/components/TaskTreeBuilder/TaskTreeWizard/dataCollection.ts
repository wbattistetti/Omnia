// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Shared type definitions for TaskTree wizard backend logic.
 * Extracted from MainDataCollection.tsx to avoid circular dependencies.
 */

export interface SchemaNode {
  label: string;
  type?: string;
  icon?: string;
  subData?: SchemaNode[];  // Legacy: schema nodes (non-Task)
  subTasks?: SchemaNode[]; // New: Task template references (from buildDataTree)
  constraints?: Constraint[];
}

export interface Constraint {
  kind: 'required' | 'range' | 'length' | 'regex' | 'enum' | 'format' | 'pastDate' | 'futureDate' | 'min' | 'max';
  title?: string;
  payoff?: string;
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  value?: string | number;
  values?: Array<string | number>;
  format?: string;
}
