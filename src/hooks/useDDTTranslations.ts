import { useMemo } from 'react';
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

  return useMemo(() => {
    if (!ddt) {
      return {};
    }

    const guids = extractGUIDsFromDDT(ddt);
    if (guids.length === 0) {
      return {};
    }

    // Extract translations from global table (already filtered by project locale)
    const translationsFromGlobal: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];

    guids.forEach(guid => {
      const translation = globalTranslations[guid];
      if (translation) {
        translationsFromGlobal[guid] = translation;
        foundGuids.push(guid);
      } else {
        missingGuids.push(guid);
      }
    });

    console.log('[useDDTTranslations] ✅ Loaded translations from global table', {
      requestedGuids: guids.length,
      uniqueGuids: [...new Set(guids)].length,
      foundTranslations: foundGuids.length,
      missingGuids: missingGuids.length,
      sampleFound: foundGuids.slice(0, 5),
      sampleMissing: missingGuids.slice(0, 5),
      globalTableSize: Object.keys(globalTranslations).length,
      // 🔍 DEBUG: Show all found translations
      allFoundTranslations: Object.entries(translationsFromGlobal).map(([k, v]) => ({
        key: k,
        value: String(v).substring(0, 50)
      })),
      // 🔍 DEBUG: Show all requested GUIDs
      allRequestedGuids: guids,
      // 🔍 DEBUG: Show global translations sample
      globalTranslationsSample: Object.entries(globalTranslations).slice(0, 10).map(([k, v]) => ({
        key: k,
        value: String(v).substring(0, 50)
      }))
    });

    return translationsFromGlobal;
  }, [ddt, globalTranslations]);
}

