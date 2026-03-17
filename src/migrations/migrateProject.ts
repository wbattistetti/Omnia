// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { detectVersion } from './detectVersion';
import { migrate_v1_to_v2 } from './migrate_v1_to_v2';
import type { VersionedProject, MigrationResult } from './types';
import type { ProjectDomainModel } from '../domain/project/model';

/**
 * Migrates a project to the current version
 * 
 * This is the entry point for project migration.
 * It detects the project version and applies the necessary migrations.
 * 
 * @param raw - Raw project data from database
 * @returns Migrated project ready for domain model mapping
 */
export function migrateProject(raw: any): ProjectDomainModel & MigrationResult {
  // Detect version
  const version = detectVersion(raw);

  // Apply migrations based on version
  let migrated: any = raw;

  if (version === '1.0') {
    // Migrate from v1.0 to v2.0
    const migrationResult = migrate_v1_to_v2(raw);
    migrated = migrationResult;
  } else if (version === '2.0') {
    // Already at v2.0, but still normalize (fix orphan tasks, broken conditions, etc.)
    const migrationResult = migrate_v1_to_v2(raw); // Reuse v1→v2 for normalization
    migrated = {
      ...migrationResult,
      version: '2.0', // Keep version as 2.0
      migrated: false, // Not migrated (already v2.0), but normalized
    };
  } else {
    // Unknown version - assume v1.0 and migrate
    console.warn(`[migrateProject] Unknown version "${version}", assuming v1.0 and migrating`);
    const migrationResult = migrate_v1_to_v2(raw);
    migrated = migrationResult;
  }

  // Return migrated project (will be mapped to domain model by mapper)
  return migrated as ProjectDomainModel & MigrationResult;
}

/**
 * Normalizes a project (applies migrations without changing version)
 * 
 * Useful for normalizing projects that are already at the current version
 * but may have inconsistencies (orphan tasks, broken conditions, etc.)
 * 
 * @param project - Project to normalize
 * @returns Normalized project
 */
export function normalizeProject(project: any): any {
  return migrate_v1_to_v2(project);
}
