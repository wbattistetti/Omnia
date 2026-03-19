/**
 * Version utilities: validation and bump for major.minor format.
 * Must match backend VERSION_PATTERN and rules.
 */

/** Regex for major.minor (e.g. 1.0, 2.3). Same as backend. */
export const VERSION_PATTERN = /^\d+\.\d+$/;

export function isValidVersion(version: string): boolean {
  if (typeof version !== 'string' || !version.trim()) return false;
  return VERSION_PATTERN.test(version.trim());
}

export interface ParsedVersion {
  major: number;
  minor: number;
}

/**
 * Parses "major.minor" string. Returns null if invalid.
 */
export function parseVersion(version: string): ParsedVersion | null {
  const trimmed = (version || '').trim();
  if (!VERSION_PATTERN.test(trimmed)) return null;
  const parts = trimmed.split('.');
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor };
}

/**
 * Returns next minor version string (e.g. "1.3" -> "1.4").
 * Falls back to "1.0" if current is invalid.
 */
export function getNextMinor(version: string): string {
  const p = parseVersion(version);
  if (!p) return '1.0';
  return `${p.major}.${p.minor + 1}`;
}

/**
 * Returns next major version string (e.g. "1.4" -> "2.0").
 * Falls back to "1.0" if current is invalid.
 */
export function getNextMajor(version: string): string {
  const p = parseVersion(version);
  if (!p) return '1.0';
  return `${p.major + 1}.0`;
}

/**
 * Compares two version strings (major.minor). Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Invalid versions are treated as "0.0".
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a) ?? { major: 0, minor: 0 };
  const pb = parseVersion(b) ?? { major: 0, minor: 0 };
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  return 0;
}

/**
 * Returns the latest version string from an array (by major.minor comparison).
 * Returns null if no valid version in the list.
 */
export function getLatestVersion(versions: string[]): string | null {
  const valid = versions.map((v) => (v || '').trim()).filter((v) => VERSION_PATTERN.test(v));
  if (valid.length === 0) return null;
  return valid.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max));
}
