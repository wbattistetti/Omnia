import { useMemo, useRef } from 'react';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { extractGUIDsFromDDT } from '../utils/ddtUtils';

/**
 * Hook to load translations for a DDT from the global translation table.
 * Extracts GUIDs from the DDT and returns filtered translations.
 *
 * This hook:
 * 1. Extracts all GUIDs (translation keys) from the DDT structure
 * 2. Loads translations from the global translation table (already filtered by project locale)
 * 3. Returns a flat dictionary of { guid: text } for the current project locale
 *
 * @param ddt - The DDT object to extract translations for
 * @returns Record<string, string> - Dictionary of translations { guid: text }
 */
export function useDDTTranslations(ddt: any | null | undefined): Record<string, string> {
  const { translations: globalTranslations } = useProjectTranslations();

  // 🎨 [HIGHLIGHT] Ref to track previous state for logging (reduced noise)
  const prevStateRef = useRef<{ foundCount?: number; missingCount?: number; ddtId?: string }>({});

  return useMemo(() => {
    if (!ddt) {
      console.log('[useDDTTranslations] ❌ No DDT provided');
      return {};
    }

    const guids = extractGUIDsFromDDT(ddt);
    if (guids.length === 0) {
      console.log('[useDDTTranslations] ⚠️ No GUIDs extracted from DDT', {
        ddtId: ddt.id,
        hasMainData: !!ddt.mainData,
        mainDataLength: ddt.mainData?.length || 0
      });
      return {};
    }

    console.log('[useDDTTranslations] 🔍 Looking for translations', {
      ddtId: ddt.id,
      requestedGuids: guids.length,
      globalTranslationsCount: Object.keys(globalTranslations).length,
      sampleRequestedGuids: guids.slice(0, 10),
      sampleGlobalGuids: Object.keys(globalTranslations).slice(0, 10)
    });

    // Extract translations from global table (already filtered by project locale)
    const translationsFromGlobal: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];
    const foundTranslations: Array<{ guid: string; text: string }> = [];

    guids.forEach(guid => {
      const translation = globalTranslations[guid];
      if (translation) {
        translationsFromGlobal[guid] = translation;
        foundGuids.push(guid);
        foundTranslations.push({ guid, text: translation.substring(0, 50) });
      } else {
        missingGuids.push(guid);
      }
    });

    // ✅ Always log detailed info
    console.log('[useDDTTranslations] ✅ Translation lookup complete', {
      ddtId: ddt.id,
      requestedGuids: guids.length,
      foundTranslations: foundGuids.length,
      missingGuids: missingGuids.length,
      globalTranslationsTotal: Object.keys(globalTranslations).length,
      sampleFound: foundTranslations.slice(0, 5),
      sampleMissing: missingGuids.slice(0, 10),
      allMissingGuids: missingGuids
    });

    prevStateRef.current = {
      foundCount: foundGuids.length,
      missingCount: missingGuids.length,
      ddtId: ddt.id
    };

    return translationsFromGlobal;
  }, [ddt, globalTranslations]);
}

