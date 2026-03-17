// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * VersionedProject: Project with version information
 */
export interface VersionedProject {
  version?: string;
  [key: string]: any;
}

/**
 * MigrationResult: Result of migration
 */
export interface MigrationResult {
  success: boolean;
  version: string;
  migrated: boolean;
  errors?: string[];
  warnings?: string[];
}
