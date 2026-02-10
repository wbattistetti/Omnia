// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect, useRef } from 'react';
import {
  checkAndGenerateMissingTranslations,
  type MissingTranslation,
} from '@services/TranslationIntegrityService';

interface UseLanguageChangeOptions {
  onMissingFound?: (missing: MissingTranslation[]) => Promise<boolean>;
  enabled?: boolean;
}

/**
 * Hook to monitor IDE language changes and check for missing translations
 * When language changes, checks if translations are missing and optionally generates them
 */
export function useLanguageChange(options: UseLanguageChangeOptions = {}) {
  const { onMissingFound, enabled = true } = options;
  const previousLanguageRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const checkLanguageChange = () => {
      try {
        const currentLanguage = localStorage.getItem('project.lang') || 'it';

        // Skip if language hasn't changed
        if (previousLanguageRef.current === currentLanguage) {
          return;
        }

        // Skip if already checking
        if (isCheckingRef.current) {
          return;
        }

        // Update previous language
        const previousLanguage = previousLanguageRef.current;
        previousLanguageRef.current = currentLanguage;

        // Skip initial load (when previousLanguage is null)
        if (previousLanguage === null) {
          return;
        }

        // Check for missing translations
        isCheckingRef.current = true;
        checkAndGenerateMissingTranslations(
          currentLanguage as 'it' | 'en' | 'pt',
          previousLanguage as 'it' | 'en' | 'pt',
          onMissingFound
        )
          .then((result) => {
            if (result.missing > 0) {
              console.log('[useLanguageChange] Missing translations found', {
                missing: result.missing,
                generated: result.generated,
                errors: result.errors,
              });
            }
          })
          .catch((error) => {
            console.error('[useLanguageChange] Error checking missing translations:', error);
          })
          .finally(() => {
            isCheckingRef.current = false;
          });
      } catch (error) {
        console.error('[useLanguageChange] Error in checkLanguageChange:', error);
        isCheckingRef.current = false;
      }
    };

    // Check on mount
    previousLanguageRef.current = localStorage.getItem('project.lang') || 'it';

    // Monitor localStorage changes
    const interval = setInterval(checkLanguageChange, 1000); // Check every second

    // Also listen to storage events (for cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'project.lang') {
        checkLanguageChange();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [enabled, onMissingFound]);
}
