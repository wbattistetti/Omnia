/**
 * Translation Tracker: Event-driven system to ensure all template translations
 * are ready before copying them to instances.
 *
 * This solves the timing issue where copyTranslationsForClonedSteps was called
 * before all translations were added to the context.
 */

interface TranslationTracker {
  templateId: string;
  expectedCount: number;
  loadedCount: number;
  loadedGuids: Set<string>;
  resolve?: () => void;
  promise?: Promise<void>;
  timeout?: NodeJS.Timeout;
}

const translationTrackers = new Map<string, TranslationTracker>();

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds max wait

/**
 * Start tracking translations for a template.
 * Returns a Promise that resolves when all expected translations are loaded.
 */
export function startTrackingTemplateTranslations(
  templateId: string,
  expectedCount: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  // Clean up any existing tracker for this template
  const existing = translationTrackers.get(templateId);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }

  // ✅ FIX: Create resolve function and timeout handler first, before creating tracker
  let resolveFn: () => void;
  let timeoutId: NodeJS.Timeout;

  const promise = new Promise<void>((resolve, reject) => {
    resolveFn = resolve;

    // Set timeout to prevent infinite waiting
    timeoutId = setTimeout(() => {
      const currentTracker = translationTrackers.get(templateId);
      if (currentTracker) {
        console.warn('[TranslationTracker] ⚠️ Timeout waiting for translations', {
          templateId,
          expectedCount,
          loadedCount: currentTracker.loadedCount,
          missingCount: expectedCount - currentTracker.loadedCount
        });
        translationTrackers.delete(templateId);
        reject(new Error(`Timeout waiting for ${expectedCount} translations for template ${templateId}. Only ${currentTracker.loadedCount} were loaded.`));
      }
    }, timeoutMs);
  });

  // Now create the tracker with all properties initialized
  const tracker: TranslationTracker = {
    templateId,
    expectedCount,
    loadedCount: 0,
    loadedGuids: new Set(),
    promise,
    resolve: resolveFn!,
    timeout: timeoutId
  };

  translationTrackers.set(templateId, tracker);

  console.log('[TranslationTracker] 🚀 Started tracking translations', {
    templateId,
    expectedCount,
    timeoutMs
  });

  return tracker.promise!;
}

/**
 * Notify that a translation has been added for a template.
 * This should be called every time addTranslation is called for a template translation.
 */
export function notifyTranslationAdded(templateId: string, guid: string): void {
  const tracker = translationTrackers.get(templateId);
  if (!tracker) {
    // No tracker for this template - translations might already be complete or tracking not started
    return;
  }

  // Skip if this GUID was already counted
  if (tracker.loadedGuids.has(guid)) {
    return;
  }

  tracker.loadedGuids.add(guid);
  tracker.loadedCount++;

  console.log('[TranslationTracker] 📝 Translation added', {
    templateId,
    guid: guid.substring(0, 8) + '...',
    loadedCount: tracker.loadedCount,
    expectedCount: tracker.expectedCount,
    progress: `${Math.round((tracker.loadedCount / tracker.expectedCount) * 100)}%`
  });

  // Check if all translations are ready
  if (tracker.loadedCount >= tracker.expectedCount && tracker.resolve) {
    if (tracker.timeout) {
      clearTimeout(tracker.timeout);
    }
    console.log('[TranslationTracker] ✅ All translations ready', {
      templateId,
      totalCount: tracker.loadedCount
    });
    tracker.resolve();
    translationTrackers.delete(templateId);
  }
}

/**
 * Notify that multiple translations have been added for a template.
 * This should be called every time addTranslations is called for template translations.
 */
export function notifyTranslationsAdded(templateId: string, guids: string[]): void {
  for (const guid of guids) {
    notifyTranslationAdded(templateId, guid);
  }
}

/**
 * Ensure all template translations are ready before proceeding.
 * This should be called before copyTranslationsForClonedSteps.
 */
export async function ensureAllTemplateTranslationsReady(templateId: string): Promise<void> {
  const tracker = translationTrackers.get(templateId);

  if (!tracker) {
    // No tracker exists - translations might already be complete
    console.log('[TranslationTracker] ℹ️ No tracker found, assuming translations are ready', {
      templateId
    });
    return Promise.resolve();
  }

  console.log('[TranslationTracker] ⏳ Waiting for all translations', {
    templateId,
    loadedCount: tracker.loadedCount,
    expectedCount: tracker.expectedCount,
    missingCount: tracker.expectedCount - tracker.loadedCount
  });

  return tracker.promise!;
}

/**
 * Cancel tracking for a template (cleanup).
 */
export function cancelTracking(templateId: string): void {
  const tracker = translationTrackers.get(templateId);
  if (tracker) {
    if (tracker.timeout) {
      clearTimeout(tracker.timeout);
    }
    translationTrackers.delete(templateId);
    console.log('[TranslationTracker] 🗑️ Tracking cancelled', { templateId });
  }
}

/**
 * Get current tracking status for a template.
 */
export function getTrackingStatus(templateId: string): {
  isTracking: boolean;
  loadedCount: number;
  expectedCount: number;
  progress: number;
} | null {
  const tracker = translationTrackers.get(templateId);
  if (!tracker) {
    return null;
  }

  return {
    isTracking: true,
    loadedCount: tracker.loadedCount,
    expectedCount: tracker.expectedCount,
    progress: tracker.expectedCount > 0
      ? Math.round((tracker.loadedCount / tracker.expectedCount) * 100)
      : 0
  };
}
