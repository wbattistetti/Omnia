import { useCallback } from 'react';
import { NLPProfile } from '../NLPExtractorProfileEditor';

/**
 * Hook for managing test cases state in extractor editors
 * Provides test cases and update function that persists to profile
 */
export function useTestValues(
  profile: NLPProfile,
  onProfileUpdate: (profile: NLPProfile) => void
) {
  const testCases = profile.testCases || [];

  const setTestCases = useCallback(
    (cases: string[]) => {
      onProfileUpdate({ ...profile, testCases: cases });
    },
    [profile, onProfileUpdate]
  );

  return {
    testCases,
    setTestCases,
  };
}

