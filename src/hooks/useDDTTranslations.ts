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

  // Track last logged state to avoid duplicate logs - use stable keys
  const lastLoggedStateRef = useRef<{
    ddtId?: string;
    missingGuidsHash?: string;
    totalGuids?: number;
    translationsCount?: number;
  }>({});

  // Use stable dependencies: serialize ddt id and translations keys
  const ddtId = ddt?.id || ddt?._id || null;
  const translationsKeys = Object.keys(globalTranslations).sort().join(',');

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

    // ✅ Log warning only if state actually changed (not just reference change)
    const currentDdtId = ddt.id || ddt._id || 'no-id';
    const missingGuidsHash = missingGuids.length > 0
      ? missingGuids.sort().join(',')
      : '';
    const totalGuids = guids.length;
    const currentTranslationsCount = Object.keys(globalTranslations).length;

    const lastState = lastLoggedStateRef.current;
    const hasStateChanged =
      lastState.ddtId !== currentDdtId ||
      lastState.missingGuidsHash !== missingGuidsHash ||
      lastState.totalGuids !== totalGuids ||
      lastState.translationsCount !== currentTranslationsCount;

    if (missingGuids.length > 0 && hasStateChanged) {
      console.warn('[useDDTTranslations] ⚠️ Missing translations', {
        ddtId: ddt.id || ddt._id || 'undefined',
        ddtLabel: ddt.label || 'no-label',
        requestedGuids: guids.length,
        foundTranslations: foundGuids.length,
        missingGuids: missingGuids.length,
        missingGuidsList: missingGuids,
        totalTranslationsInContext: currentTranslationsCount,
        sampleMissing: missingGuids.slice(0, 10),
        // Debug info to understand why translations are missing
        debug: {
          hasGlobalTranslations: Object.keys(globalTranslations).length > 0,
          sampleGuids: guids.slice(0, 5),
          sampleFound: foundGuids.slice(0, 5),
        sampleMissing: missingGuids.slice(0, 5)
        }
      });

      // Update last logged state
      lastLoggedStateRef.current = {
        ddtId: currentDdtId,
        missingGuidsHash,
        totalGuids,
        translationsCount: currentTranslationsCount
      };
    }

    return translationsFromGlobal;
  }, [ddtId, translationsKeys, ddt, globalTranslations]);
}

