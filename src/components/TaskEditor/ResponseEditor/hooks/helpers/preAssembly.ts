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

    const { assembleFinalTaskTree } = await import('../../../../TaskTreeBuilder/TaskTreeWizard/assembleFinal');
    const { buildArtifactStore } = await import('../../../../TaskTreeBuilder/TaskTreeWizard/artifactStore');

    const emptyStore = buildArtifactStore([]);
    const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';

    // ✅ assembleFinalTaskTree restituisce ancora formato legacy, convertiamo a TaskTree
    // Normalize schema.nodes - use standard format or log warning for legacy
    let schemaNodes: any[] = [];
    if (schema.nodes && Array.isArray(schema.nodes)) {
      schemaNodes = schema.nodes;
    } else if (schema.data && Array.isArray(schema.data)) {
      console.warn('[preAssembleTaskTree] Using legacy schema.data format, expected schema.nodes');
      schemaNodes = schema.data;
    } else {
      console.warn('[preAssembleTaskTree] No schema.nodes or schema.data found, using empty array');
    }

    const preAssembledLegacy = await assembleFinalTaskTree(
      schema.label || 'Data',
      schemaNodes,
      emptyStore,
      {
        escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
        templateTranslations: templateTranslations,
        projectLocale: projectLang,
        addTranslations: () => { }
      }
    );

    // ✅ Converti formato legacy a TaskTree
    // Normalize nodes - use standard format or throw error
    let normalizedNodes: any[] = [];
    if (preAssembledLegacy.nodes && Array.isArray(preAssembledLegacy.nodes)) {
      normalizedNodes = preAssembledLegacy.nodes;
    } else if (preAssembledLegacy.data && Array.isArray(preAssembledLegacy.data)) {
      console.warn('[preAssembleTaskTree] Converting legacy preAssembledLegacy.data to nodes format');
      normalizedNodes = preAssembledLegacy.data;
    } else {
      console.warn('[preAssembleTaskTree] No nodes or data found in preAssembledLegacy, using empty array');
    }

    const preAssembledTaskTree = {
      label: preAssembledLegacy.label || schema.label || 'Data',
      nodes: normalizedNodes,
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


