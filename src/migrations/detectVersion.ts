// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { VersionedProject } from './types';

/**
 * Detects project version from raw project data
 *
 * Version detection strategy:
 * - v2.0: Has version field and uses engines (not parsers)
 * - v1.0: No version field or uses parsers (legacy)
 *
 * @param raw - Raw project data from database
 * @returns Detected version
 */
export function detectVersion(raw: any): string {
  // If version is explicitly set, use it
  if (raw.version) {
    return raw.version;
  }

  // Check for v2.0 indicators: uses engines (not parsers)
  // This is a heuristic - projects with engines are likely v2.0
  const hasEngines = raw.tasks?.some((t: any) =>
    t.dataContract?.engines ||
    t.engines
  ) || raw.templates?.some((t: any) =>
    t.dataContract?.engines ||
    t.engines
  );

  // Check for v1.0 indicators: uses parsers (legacy)
  const hasParsers = raw.tasks?.some((t: any) =>
    t.dataContract?.parsers ||
    t.parsers
  ) || raw.templates?.some((t: any) =>
    t.dataContract?.parsers ||
    t.parsers
  );

  // If has engines and no parsers, likely v2.0
  if (hasEngines && !hasParsers) {
    return '2.0';
  }

  // If has parsers, definitely v1.0
  if (hasParsers) {
    return '1.0';
  }

  // Default: assume v1.0 (legacy projects)
  return '1.0';
}
