/**
 * Copia i letterali SEND nella Mock Table (celle vuote e prima riga assente).
 * Non è un fallback HTTP invisibile: persiste `row.inputs` così la tabella riflette ciò che parte in Test API.
 */

import type { BackendExecutionMode } from './backendTestRowTypes';
import type { BackendMockTableRow } from './backendTestRowTypes';
import { isBackendMockInputCellFilled } from './backendMockRowCompletion';

function newRowId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `row_${crypto.randomUUID()}`;
  }
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param sendLiteralsByWireKey output di `buildLiteralFallbackFromSendMapping` (chiave = internalName / wireKey colonna)
 */
export function ensureMockTablePrefilledFromSendLiterals(
  rows: BackendMockTableRow[],
  activeInputInternalNames: readonly string[],
  sendLiteralsByWireKey: Readonly<Record<string, string>>,
  defaultExecutionMode: BackendExecutionMode
): BackendMockTableRow[] {
  const names = activeInputInternalNames.map((n) => String(n).trim()).filter(Boolean);
  if (names.length === 0) return rows;

  const mergeLiteralsIntoInputs = (inputs: Record<string, unknown>): Record<string, unknown> => {
    const next = { ...inputs };
    for (const n of names) {
      const lit = sendLiteralsByWireKey[n];
      if (!isBackendMockInputCellFilled(next[n]) && typeof lit === 'string' && lit.trim() !== '') {
        next[n] = lit;
      }
    }
    return next;
  };

  if (rows.length === 0) {
    const inputs: Record<string, unknown> = {};
    for (const n of names) {
      const lit = sendLiteralsByWireKey[n];
      if (typeof lit === 'string' && lit.trim() !== '') {
        inputs[n] = lit;
      }
    }
    if (Object.keys(inputs).length === 0) {
      return rows;
    }
    return [
      {
        id: newRowId(),
        inputs,
        outputs: {},
        testRun: {
          executionMode: defaultExecutionMode,
          notes: {},
        },
      },
    ];
  }

  return rows.map((row) => ({
    ...row,
    inputs: mergeLiteralsIntoInputs(row.inputs ?? {}),
  }));
}
