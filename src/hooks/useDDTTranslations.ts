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

    // 🎨 [HIGHLIGHT] Log only when values change significantly or there are missing translations
    const prev = prevStateRef.current;
    const current = {
      foundCount: foundGuids.length,
      missingCount: missingGuids.length,
      ddtId: ddt.id
    };

    if (
      prev.foundCount !== current.foundCount ||
      prev.missingCount !== current.missingCount ||
      prev.ddtId !== current.ddtId ||
      current.missingCount > 0 // Always log if there are missing translations
    ) {
      // Only log if there are missing translations or significant changes
      if (current.missingCount > 0 || prev.ddtId !== current.ddtId) {
        console.log('[useDDTTranslations] ✅ Loaded translations', {
          ddtId: current.ddtId,
          requestedGuids: guids.length,
          foundTranslations: current.foundCount,
          missingGuids: current.missingCount,
          sampleMissing: missingGuids.slice(0, 5)
        });
      }
      prevStateRef.current = current;
    }

    return translationsFromGlobal;
  }, [ddt, globalTranslations]);
}

