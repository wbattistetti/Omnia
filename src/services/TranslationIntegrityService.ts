// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * TranslationIntegrityService
 *
 * Service to check and generate missing template label translations.
 * IDE translations use type: LABEL and projectId: null.
 */

export interface MissingTranslation {
  guid: string;
  label: string; // Current label in source language
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationGenerationResult {
  success: boolean;
  missing: number;
  generated: number;
  errors?: string[];
}

/**
 * Check which template IDs are missing translations for a given language
 */
export async function checkMissingTranslations(
  targetLanguage: 'it' | 'en' | 'pt'
): Promise<MissingTranslation[]> {
  try {
    const response = await fetch(`/api/factory/check-missing-translations?language=${targetLanguage}`);

    if (!response.ok) {
      throw new Error(`Failed to check missing translations: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.missing || [];
  } catch (error) {
    console.error('[TranslationIntegrityService] Error checking missing translations:', error);
    throw error;
  }
}

/**
 * Generate missing translations via AI
 */
export async function generateMissingTranslations(
  missingIds: string[],
  targetLanguage: 'it' | 'en' | 'pt',
  sourceLanguage: 'it' | 'en' | 'pt'
): Promise<{ success: boolean; generated: number; errors?: string[] }> {
  if (missingIds.length === 0) {
    return { success: true, generated: 0 };
  }

  try {
    const response = await fetch('/api/factory/generate-template-translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateIds: missingIds,
        targetLanguage,
        sourceLanguage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate translations: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      success: data.success || false,
      generated: data.generated || 0,
      errors: data.errors,
    };
  } catch (error) {
    console.error('[TranslationIntegrityService] Error generating translations:', error);
    throw error;
  }
}

/**
 * Check for missing translations and generate them if user accepts
 * Returns the number of missing translations found
 */
export async function checkAndGenerateMissingTranslations(
  targetLanguage: 'it' | 'en' | 'pt',
  sourceLanguage: 'it' | 'en' | 'pt',
  onMissingFound?: (missing: MissingTranslation[]) => Promise<boolean> // Returns true if user accepts generation
): Promise<TranslationGenerationResult> {
  try {
    // Check for missing translations
    const missing = await checkMissingTranslations(targetLanguage);

    if (missing.length === 0) {
      return {
        success: true,
        missing: 0,
        generated: 0,
      };
    }

    // If callback provided, ask user for confirmation
    let shouldGenerate = true;
    if (onMissingFound) {
      shouldGenerate = await onMissingFound(missing);
    }

    if (!shouldGenerate) {
      return {
        success: true,
        missing: missing.length,
        generated: 0,
      };
    }

    // Generate translations
    const missingIds = missing.map(m => m.guid);
    const result = await generateMissingTranslations(missingIds, targetLanguage, sourceLanguage);

    return {
      success: result.success,
      missing: missing.length,
      generated: result.generated || 0,
      errors: result.errors,
    };
  } catch (error) {
    console.error('[TranslationIntegrityService] Error in checkAndGenerateMissingTranslations:', error);
    return {
      success: false,
      missing: 0,
      generated: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
