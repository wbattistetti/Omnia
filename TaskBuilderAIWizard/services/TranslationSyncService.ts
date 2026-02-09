// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';
import { TranslationType } from '../../src/types/translationTypes';

/**
 * Translation entry to save in Translations collection
 */
interface TranslationEntry {
  guid: string;
  language: string;
  text: string;
  type?: TranslationType;
  projectId?: string | null;
}

/**
 * Sync translations with structure: add all labels and variable names to Translations collection
 *
 * This function:
 * 1. Adds Label translations (for UI)
 * 2. Adds VariableReadableName translations (for Condition Editor)
 * 3. Adds VariableDottedName translations (for hierarchical variables)
 *
 * @param structure Array of WizardTaskTreeNode with readableName and dottedName populated
 * @param projectId Project ID (null for factory/templates)
 * @param locale Project locale (default: 'it')
 * @returns Array of TranslationEntry to save
 */
export function generateTranslationEntries(
  structure: WizardTaskTreeNode[],
  projectId: string | null,
  locale: string = 'it'
): TranslationEntry[] {
  const entries: TranslationEntry[] = [];

  function processNode(node: WizardTaskTreeNode): void {
    // 1. Label translation (for UI)
    if (node.label) {
      entries.push({
        guid: node.id,
        language: locale,
        text: node.label,
        type: TranslationType.LABEL,
        projectId,
      });
    }

    // 2. VariableReadableName translation (if present)
    if (node.readableName) {
      entries.push({
        guid: node.id,
        language: locale, // Variable names are in project base language
        text: node.readableName,
        type: TranslationType.VARIABLE_READABLE_NAME,
        projectId,
      });
    }

    // 3. VariableDottedName translation (if present)
    if (node.dottedName) {
      entries.push({
        guid: node.id,
        language: locale, // Variable names are in project base language
        text: node.dottedName,
        type: TranslationType.VARIABLE_DOTTED_NAME,
        projectId,
      });
    }

    // Process children recursively
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach(processNode);
    }
  }

  // Process all root nodes
  structure.forEach(processNode);

  return entries;
}

/**
 * Save translations to backend
 *
 * @param translations Array of TranslationEntry
 * @param projectId Project ID
 * @returns Promise<boolean> Success status
 */
export async function saveTranslations(
  translations: TranslationEntry[],
  projectId: string
): Promise<boolean> {
  if (!translations || translations.length === 0) {
    return true; // Nothing to save
  }

  try {
    const response = await fetch(`/api/projects/${projectId}/translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        translations: translations.map((t) => ({
          guid: t.guid,
          language: t.language,
          text: t.text,
          type: t.type || TranslationType.LABEL,
        })),
      }),
    });

    if (!response.ok) {
      console.error('[TranslationSyncService] Failed to save translations', response.statusText);
      return false;
    }

    console.log('[TranslationSyncService] Saved translations', {
      count: translations.length,
      projectId,
    });

    return true;
  } catch (error) {
    console.error('[TranslationSyncService] Error saving translations', error);
    return false;
  }
}

/**
 * Sync translations with structure and save to backend
 *
 * @param structure Array of WizardTaskTreeNode with readableName and dottedName populated
 * @param projectId Project ID
 * @param locale Project locale (default: 'it')
 * @returns Promise<boolean> Success status
 */
export async function syncTranslationsWithStructure(
  structure: WizardTaskTreeNode[],
  projectId: string,
  locale: string = 'it'
): Promise<boolean> {
  const entries = generateTranslationEntries(structure, projectId, locale);
  return await saveTranslations(entries, projectId);
}
