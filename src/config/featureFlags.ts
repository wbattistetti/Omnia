// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Feature Flags for Runtime Configuration
 *
 * Allows runtime configuration changes without redeploying.
 * Set via localStorage for development/testing.
 */

export interface FeatureFlags {
  // TaskRepository: disable deep merge in updateTask (steps are updated directly)
  DISABLE_MERGE_PROFONDO: boolean;
  // Development: enable verbose logging
  LOG_VERBOSE: boolean;
  /**
   * Wizard completion rewrites the row as embedded (subTasks on row) and clears templateId.
   * In dev, defaults to true (standalone row after wizard). Override with localStorage
 * featureFlag_WIZARD_INSTANCE_FIRST = "false" to disable. Prod defaults to false.
   */
  WIZARD_INSTANCE_FIRST: boolean;
}

/**
 * Get feature flag value from localStorage
 */
function getFeatureFlag(
  key: keyof FeatureFlags,
  defaultValue: boolean = false
): boolean {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  const stored = localStorage.getItem(`featureFlag_${key}`);
  if (stored !== null) {
    return stored === 'true';
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
}

/** Default for wizard instance-first: on in Vite dev (no localStorage), off in prod until explicitly enabled. */
function defaultWizardInstanceFirst(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return import.meta.env.DEV;
}

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    DISABLE_MERGE_PROFONDO: getFeatureFlag('DISABLE_MERGE_PROFONDO', false),
    LOG_VERBOSE: getFeatureFlag('LOG_VERBOSE', false),
    WIZARD_INSTANCE_FIRST: getFeatureFlag('WIZARD_INSTANCE_FIRST', defaultWizardInstanceFirst()),
  };
}

/**
 * Feature flags singleton
 */
export const FEATURE_FLAGS = getFeatureFlags();

/**
 * Reads localStorage on each call (not the FEATURE_FLAGS snapshot).
 */
export function isWizardInstanceFirstEnabled(): boolean {
  return getFeatureFlag('WIZARD_INSTANCE_FIRST', defaultWizardInstanceFirst());
}
