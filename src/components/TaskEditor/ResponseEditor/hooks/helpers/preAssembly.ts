// preAssembly.ts
// Service per pre-assembly TaskTree in background (ottimizzazione performance)
// Carica traduzioni e pre-assembla TaskTree per migliorare UX

import React from 'react';

export interface PreAssemblyCache {
  taskTree: any;
  _templateTranslations: Record<string, { en: string; it: string; pt: string }>;
}

/**
 * Pre-assembla il TaskTree in background per migliorare le performance
 *
 * @param schema - Schema TaskTree da assemblare
 * @param translationGuids - GUID delle traduzioni da caricare
 * @param templateId - ID del template (per cache)
 * @param cache - Cache ref per memorizzare risultato
 * @returns Promise che risolve quando pre-assembly è completo
 */
export async function preAssembleTaskTree(
  schema: any,
  translationGuids: string[],
  templateId: string | undefined,
  cache: React.MutableRefObject<Map<string, PreAssemblyCache>>
): Promise<void> {
  if (translationGuids.length === 0 || !schema) {
    return;
  }

  // Controlla cache
  if (templateId && cache.current.has(templateId)) {
    return; // Già in cache, non serve pre-assemblare
  }

  try {
    const { getTemplateTranslations } = await import('../../../../../services/ProjectDataService');
    const templateTranslations = await getTemplateTranslations(translationGuids);

    const { assembleFinalDDT } = await import('../../../../DialogueDataTemplateBuilder/DDTWizard/assembleFinal');
    const { buildArtifactStore } = await import('../../../../DialogueDataTemplateBuilder/DDTWizard/artifactStore');

    const emptyStore = buildArtifactStore([]);
    const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';

    // ✅ assembleFinalDDT restituisce ancora formato legacy, convertiamo a TaskTree
    const preAssembledLegacy = await assembleFinalDDT(
      schema.label || 'Data',
      schema.nodes || schema.data || [],
      emptyStore,
      {
        escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
        templateTranslations: templateTranslations,
        projectLocale: projectLang,
        addTranslations: () => { }
      }
    );

    // ✅ Converti formato legacy a TaskTree
    const preAssembledTaskTree = {
      label: preAssembledLegacy.label || schema.label || 'Data',
      nodes: preAssembledLegacy.data || [],
      steps: preAssembledLegacy.dialogueSteps || {},
      constraints: preAssembledLegacy.constraints,
      dataContract: preAssembledLegacy.dataContract,
      introduction: preAssembledLegacy.introduction
    };

    if (templateId) {
      cache.current.set(templateId, {
        taskTree: preAssembledTaskTree,
        _templateTranslations: templateTranslations
      });
    }
  } catch (err) {
    console.error('[preAssembly] Errore pre-assemblaggio:', err);
  }
}

// ❌ RIMOSSO: preAssembleDDT - Usa preAssembleTaskTree invece


