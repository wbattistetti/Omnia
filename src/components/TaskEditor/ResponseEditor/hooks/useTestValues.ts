import { useCallback, useState, useEffect, useRef } from 'react';
import { NLPProfile } from '../DataExtractionEditor';

/**
 * Hook for managing test cases state in extractor editors
 * Provides test cases and update function that persists to profile
 *
 * Strategy:
 * - Maintain local state for immediate UI updates
 * - Sync with profile only when profile changes from external source
 * - Prevent race condition: when we update locally, don't sync back until profile is updated
 */
export function useTestValues(
  profile: NLPProfile,
  onProfileUpdate: (profile: NLPProfile) => void
) {
  // Local state for immediate UI updates
  const [testCases, setTestCasesLocal] = useState<string[]>(profile.testCases || []);

  // Track the last value we set locally to prevent sync from resetting during race condition
  // When we call setTestCases, we store the JSON of what we're setting
  // The sync effect will skip if profile matches this value (meaning our update was persisted)
  // OR if profile has fewer items than local (meaning profile hasn't been updated yet)
  const lastSetValueRef = useRef<string>('');

  // Sync local state with profile when profile changes (from external source only)
  useEffect(() => {
    const profileTestCases = profile.testCases || [];
    const profileKey = JSON.stringify(profileTestCases);

    // Case 1: Profile matches what we just set locally → skip (our update was persisted)
    if (profileKey === lastSetValueRef.current) {
      return;
    }

    // Case 2: Profile has fewer test cases than local AND we just set something locally
    // → This is a race condition: profile hasn't been updated yet, don't reset
    // We check this by comparing with the last set value's length
    if (lastSetValueRef.current) {
      const lastSetValue = JSON.parse(lastSetValueRef.current) as string[];
      if (profileTestCases.length < lastSetValue.length) {
        return; // Race condition: profile not updated yet
      }
    }

    // Case 3: Profile differs from local → sync from profile (external change)
    // This happens when editor is reopened or node changes
    setTestCasesLocal(prev => {
      const prevKey = JSON.stringify(prev);
      if (profileKey !== prevKey) {
        // Reset lastSetValueRef when syncing from external source (e.g., editor reopened)
        // This ensures we don't block future updates
        lastSetValueRef.current = '';
        return profileTestCases;
      }
      return prev;
    });
  }, [profile.testCases, profile.slotId]);

  const setTestCases = useCallback(
    (cases: string[]) => {
      // Track what we're setting (as JSON for comparison)
      const casesKey = JSON.stringify(cases);
      lastSetValueRef.current = casesKey;

      // Update local state immediately for UI responsiveness
      setTestCasesLocal(cases);

      // Persist to profile (this will trigger profile memo recalculation)
      // Always include the latest testCases in the update
      onProfileUpdate({ ...profile, testCases: cases });
    },
    [profile, onProfileUpdate]
  );

  return {
    testCases,
    setTestCases,
  };
}

