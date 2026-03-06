// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Feature Flags for Refactoring
 *
 * Allows gradual migration and safe rollback during refactoring.
 * Set via environment variables or localStorage.
 */

export interface FeatureFlags {
  // TaskRepository refactoring
  USE_SIMPLIFIED_TASK_REPOSITORY: boolean;
  USE_DIRECT_TASK_UPDATES: boolean;
  DISABLE_MERGE_PROFONDO: boolean;

  // buildTaskTree refactoring
  USE_SIMPLIFIED_BUILD_TASK_TREE: boolean;

  // Persistence refactoring
  USE_DIRECT_PERSISTENCE: boolean;
  DISABLE_EXTRACT_TASK_OVERRIDES: boolean;

  // Validation (development only)
  VALIDATE_REFACTORING: boolean; // Run old and new code in parallel and compare
  LOG_REFACTORING_CHANGES: boolean; // Log all refactoring-related changes
}

/**
 * Get feature flag value
 * Priority: localStorage > environment variable > default
 */
function getFeatureFlag(
  key: keyof FeatureFlags,
  defaultValue: boolean = false
): boolean {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable
    const envKey = `FEATURE_${key}`;
    const envValue = process.env[envKey];
    return envValue === 'true' || defaultValue;
  }

  // Client-side: check localStorage first, then environment
  const stored = localStorage.getItem(`featureFlag_${key}`);
  if (stored !== null) {
    return stored === 'true';
  }

  const envKey = `FEATURE_${key}`;
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    return envValue === 'true';
  }

  return defaultValue;
}

/**
 * Set feature flag (for testing/debugging)
 */
export function setFeatureFlag(
  key: keyof FeatureFlags,
  value: boolean
): void {
  if (typeof window === 'undefined') {
    console.warn('[FeatureFlags] Cannot set feature flag on server-side');
    return;
  }

  localStorage.setItem(`featureFlag_${key}`, value ? 'true' : 'false');
  console.log(`[FeatureFlags] Set ${key} = ${value}`);
}

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    USE_SIMPLIFIED_TASK_REPOSITORY: getFeatureFlag('USE_SIMPLIFIED_TASK_REPOSITORY', false),
    USE_DIRECT_TASK_UPDATES: getFeatureFlag('USE_DIRECT_TASK_UPDATES', false),
    DISABLE_MERGE_PROFONDO: getFeatureFlag('DISABLE_MERGE_PROFONDO', false),
    USE_SIMPLIFIED_BUILD_TASK_TREE: getFeatureFlag('USE_SIMPLIFIED_BUILD_TASK_TREE', false),
    USE_DIRECT_PERSISTENCE: getFeatureFlag('USE_DIRECT_PERSISTENCE', false),
    DISABLE_EXTRACT_TASK_OVERRIDES: getFeatureFlag('DISABLE_EXTRACT_TASK_OVERRIDES', false),
    VALIDATE_REFACTORING: getFeatureFlag('VALIDATE_REFACTORING', process.env.NODE_ENV === 'development'),
    LOG_REFACTORING_CHANGES: getFeatureFlag('LOG_REFACTORING_CHANGES', process.env.NODE_ENV === 'development'),
  };
}

/**
 * Feature flags singleton
 */
export const FEATURE_FLAGS = getFeatureFlags();

/**
 * Refresh feature flags (call after localStorage changes)
 */
export function refreshFeatureFlags(): void {
  Object.assign(FEATURE_FLAGS, getFeatureFlags());
}
