/**
 * Validation for "Salva come" dialog: unicity and linear versioning rules.
 * Ensures (projectName, clientName, major, minor) is unique and version progression is linear.
 */

import { parseVersion } from './versionUtils';

export interface ExistingVersionEntry {
  projectName: string;
  clientName: string;
  major: number;
  minor: number;
}

export interface ValidateSaveAsParams {
  projectName: string;
  clientName: string;
  major: number;
  minor: number;
  existingEntries: ExistingVersionEntry[];
  /** Original project name when dialog opened (same app = linear rules apply). */
  originalProjectName: string;
  /** Original client when dialog opened. */
  originalClientName: string;
  /** Version currently open (same project): required for "major exists" rule. */
  currentMajor: number;
  currentMinor: number;
}

export const SAVE_AS_ERRORS = {
  DUPLICATE: 'Esiste già una versione con questo nome, cliente e versione.',
  MINOR_MUST_BE_GREATER: 'La minor deve essere maggiore della minor massima per questa major.',
  NEW_MAJOR_MUST_START_AT_ZERO: 'Una nuova major deve iniziare da .0.',
  MAJOR_CANNOT_BE_LOWER: 'Non puoi creare una major inferiore alla major più recente.',
  OPEN_MUST_BE_LATEST_FOR_MAJOR: 'Per creare una nuova minor per questa major devi avere aperta l\'ultima versione disponibile per quella major.',
} as const;

export interface ValidateSaveAsResult {
  valid: boolean;
  error?: string;
  /** When major exists: suggested next minor (maxMinorForMajor[major] + 1). For UI hint or prefill. */
  suggestedMinor?: number;
  /** When error is OPEN_MUST_BE_LATEST_FOR_MAJOR: the version the user should have open (e.g. "1.3"). */
  suggestedOpenVersion?: string;
}

/**
 * Returns entries for the same project (same projectName and clientName).
 */
function sameProject(entries: ExistingVersionEntry[], projectName: string, clientName: string): ExistingVersionEntry[] {
  const p = (projectName || '').trim();
  const c = (clientName || '').trim();
  return entries.filter(
    (e) => (e.projectName || '').trim() === p && (e.clientName || '').trim() === c
  );
}

/**
 * Max major version among entries for the same project/client.
 */
export function getMaxMajor(
  entries: ExistingVersionEntry[],
  projectName: string,
  clientName: string
): number {
  const same = sameProject(entries, projectName, clientName);
  if (same.length === 0) return 0;
  return Math.max(...same.map((e) => e.major));
}

/**
 * For each major X, the highest minor among entries for the same project/client.
 * e.g. { 1: 3, 2: 0 } means major 1 has max minor 3, major 2 has max minor 0.
 */
export function getMaxMinorForMajor(
  entries: ExistingVersionEntry[],
  projectName: string,
  clientName: string
): Record<number, number> {
  const same = sameProject(entries, projectName, clientName);
  const map: Record<number, number> = {};
  for (const e of same) {
    const prev = map[e.major];
    if (prev === undefined || e.minor > prev) map[e.major] = e.minor;
  }
  return map;
}

/**
 * Checks if (projectName, clientName, major, minor) already exists in entries.
 */
export function combinationExists(
  entries: ExistingVersionEntry[],
  projectName: string,
  clientName: string,
  major: number,
  minor: number
): boolean {
  const p = (projectName || '').trim();
  const c = (clientName || '').trim();
  return entries.some(
    (e) =>
      (e.projectName || '').trim() === p &&
      (e.clientName || '').trim() === c &&
      e.major === major &&
      e.minor === minor
  );
}

/**
 * Full validation for "Salva come":
 * 1. Unicity: (projectName, clientName, major, minor) must not already exist.
 * 2. If projectName and clientName are unchanged (same app): linear rules A, B, C.
 *    Case A (major exists): (1) open version must be the latest for that major, (2) minor > maxMinor, with suggestedMinor = maxMinor+1.
 */
export function validateSaveAs(params: ValidateSaveAsParams): ValidateSaveAsResult {
  const {
    projectName,
    clientName,
    major,
    minor,
    existingEntries,
    originalProjectName,
    originalClientName,
    currentMajor,
    currentMinor,
  } = params;

  const pName = (projectName || '').trim();
  const cName = (clientName || '').trim();
  const origName = (originalProjectName || '').trim();
  const origClient = (originalClientName || '').trim();

  if (!pName) {
    return { valid: false, error: 'Il nome progetto è obbligatorio.' };
  }

  // 1. Unicity
  if (combinationExists(existingEntries, projectName, clientName, major, minor)) {
    return { valid: false, error: SAVE_AS_ERRORS.DUPLICATE };
  }

  const nameOrClientChanged = pName !== origName || cName !== origClient;

  // If name or client changed, only unicity applies (no linear rules).
  if (nameOrClientChanged) {
    return { valid: true };
  }

  // Same project: apply linear versioning rules (A, B, C).
  const same = sameProject(existingEntries, projectName, clientName);
  const maxMajor = getMaxMajor(existingEntries, projectName, clientName);
  const maxMinorForMajor = getMaxMinorForMajor(existingEntries, projectName, clientName);

  // Case C: major set does not exist and is LESS than max major → not allowed
  const majorExists = same.some((e) => e.major === major);
  if (!majorExists && major < maxMajor) {
    return { valid: false, error: SAVE_AS_ERRORS.MAJOR_CANNOT_BE_LOWER };
  }

  // Case B: major is GREATER than max major → minor must be 0
  if (major > maxMajor) {
    if (minor !== 0) {
      return { valid: false, error: SAVE_AS_ERRORS.NEW_MAJOR_MUST_START_AT_ZERO };
    }
    return { valid: true };
  }

  // Case A: major already exists → (1) open version must be latest for that major, (2) minor > maxMinor
  if (majorExists) {
    const maxMinor = maxMinorForMajor[major] ?? -1;
    const suggestedMinor = maxMinor + 1;
    const openIsLatestForMajor = currentMajor === major && currentMinor === maxMinor;

    if (!openIsLatestForMajor) {
      return {
        valid: false,
        error: SAVE_AS_ERRORS.OPEN_MUST_BE_LATEST_FOR_MAJOR,
        suggestedOpenVersion: `${major}.${maxMinor}`,
      };
    }
    if (minor <= maxMinor) {
      return {
        valid: false,
        error: SAVE_AS_ERRORS.MINOR_MUST_BE_GREATER,
        suggestedMinor,
      };
    }
    return { valid: true, suggestedMinor };
  }

  return { valid: true };
}

/**
 * Build ExistingVersionEntry[] from catalog-style list (projectName/name, clientName, version string).
 */
export function catalogToExistingEntries(
  catalog: Array<{ projectName?: string; name?: string; clientName?: string; version?: string }>
): ExistingVersionEntry[] {
  const out: ExistingVersionEntry[] = [];
  for (const p of catalog) {
    const version = (p.version || '').trim();
    const parsed = parseVersion(version);
    if (!parsed) continue;
    const projectName = (p.projectName || p.name || '').trim();
    const clientName = (p.clientName ?? '').trim();
    out.push({
      projectName,
      clientName,
      major: parsed.major,
      minor: parsed.minor,
    });
  }
  return out;
}
