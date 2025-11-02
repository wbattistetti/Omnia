import React, { useCallback } from 'react';
import { NLPProfile } from '../NLPExtractorProfileEditor';

/**
 * Hook for managing test cases state in extractor editors
 * Provides test cases and update function that persists to profile
 */
export function useTestValues(
  profile: NLPProfile,
  onProfileUpdate: (profile: NLPProfile) => void
) {
  // 🔍 LOG: Verifica profile ricevuto
  console.log('[useTestValues] 📥 Profile received:', {
    slotId: profile.slotId,
    hasTestCases: 'testCases' in profile,
    testCasesType: typeof profile.testCases,
    testCasesIsArray: Array.isArray(profile.testCases),
    testCasesLength: Array.isArray(profile.testCases) ? profile.testCases.length : 'N/A',
    testCasesValue: profile.testCases,
    profileKeys: Object.keys(profile),
  });

  const testCases = profile.testCases || [];

  // 🔍 LOG: Verifica test cases estratti
  console.log('[useTestValues] ✅ Test cases extracted:', {
    slotId: profile.slotId,
    testCasesCount: testCases.length,
    testCasesValue: testCases,
  });

  const setTestCases = useCallback(
    (cases: string[]) => {
      console.log('[useTestValues] 🔄 setTestCases called:', {
        slotId: profile.slotId,
        casesCount: cases.length,
        casesValue: cases,
      });
      onProfileUpdate({ ...profile, testCases: cases });
    },
    [profile, onProfileUpdate]
  );

  return {
    testCases,
    setTestCases,
  };
}

