/**
 * Design-time backend mock table: test run metadata per riga (tester + audit leggero).
 */

export const BackendExecutionMode = {
  MOCK: 'MOCK',
  REAL: 'REAL',
} as const;

export type BackendExecutionMode = (typeof BackendExecutionMode)[keyof typeof BackendExecutionMode];

/** Risposta ultima esecuzione test (persistita sulla riga). */
export type BackendTestLastResponse = {
  status?: number;
  rawJson: string;
  /** Anteprima breve (lista o testo troncato). */
  preview?: string;
  error?: string;
};

/** Metadati tester / audit semplificato (solo ultima run + note). */
export type BackendMockTableRowTestRun = {
  executionMode: BackendExecutionMode;
  lastResponse?: BackendTestLastResponse;
  /** Chiavi: `input:colName` | `output:colName` → testo nota. */
  notes?: Record<string, string>;
  lastTestedAt?: string;
};

export type BackendMockTableRow = {
  id: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  testRun?: BackendMockTableRowTestRun;
};

/** Chiave stabile per note: tipo colonna + nome colonna interno. */
export function backendTestNoteKey(zone: 'input' | 'output', columnName: string): string {
  return `${zone}:${columnName}`;
}
