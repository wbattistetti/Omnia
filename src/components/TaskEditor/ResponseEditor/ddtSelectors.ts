// Puri selettori/mappers per TaskTree. Nessuna dipendenza da React.
// Le funzioni sono tolleranti a strutture diverse (steps come array o come oggetto, messages annidati, ecc.)
//
// ✅ REFACTORED: This file now re-exports from core/domain for backward compatibility.
// New code should import directly from core/domain.

import {
  getMainNodes,
  getSubNodes,
  getNodeStepKeys,
  getNodeStepData,
  findNodeByIndices,
  getNodeLabel,
  hasMultipleMainNodes,
} from './core/domain';

/**
 * Get node list from TaskTree
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use getMainNodes from core/domain instead
 */
export function getdataList(taskTree: any): any[] {
  return getMainNodes(taskTree);
}

/**
 * Get sub-node list from main node (TaskTree format)
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use getSubNodes from core/domain instead
 */
export function getSubDataList(main: any): any[] {
  return getSubNodes(main);
}

/**
 * Get node step keys
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use getNodeStepKeys from core/domain instead
 */
export function getNodeSteps(node: any): string[] {
  if (!node) {
    console.log('[🔍 getNodeSteps] ❌ Node is null/undefined');
    return [];
  }
  
  const stepKeys = getNodeStepKeys(node);
  
  // Log for debugging (preserving original behavior)
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    const stepKeysArray = Object.keys(node.steps);
    console.log('[🔍 getNodeSteps] ✅ Found dictionary steps', {
      nodeId: node.id,
      nodeLabel: node.label,
      stepKeys: stepKeysArray,
      stepKeysCount: stepKeysArray.length,
      stepsPreview: stepKeysArray.slice(0, 5).map(k => ({
        key: k,
        hasEscalations: Array.isArray(node.steps[k]?.escalations) && node.steps[k].escalations.length > 0
      }))
    });
  }
  
  return stepKeys;
}

/**
 * Get messages/step data for a specific step key
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use getNodeStepData from core/domain instead
 */
export function getMessagesFor(node: any, stepKey: string): any {
  return getNodeStepData(node, stepKey);
}

/**
 * Find a node in TaskTree by indices
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use findNodeByIndices from core/domain instead
 */
export function findNode(taskTree: any, mainIndex: number, subIndex: number | null): any {
  return findNodeByIndices(taskTree, mainIndex, subIndex);
}

/**
 * Get node label from Translations or fallback to node.label
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use getNodeLabel from core/domain instead
 */
export function getLabel(node: any, translations?: Record<string, string>): string {
  return getNodeLabel(node, translations);
}

/**
 * Check if TaskTree has multiple main nodes
 * ✅ Uses domain layer function (backward compatible)
 * @deprecated Use hasMultipleMainNodes from core/domain instead
 */
export function hasMultipleMains(taskTree: any): boolean {
  return hasMultipleMainNodes(taskTree);
}

/**
 * React hook to get node label from Translations
 * Use this in React components that have access to ProjectTranslationsContext
 */
export function useNodeLabel(node: any): string {
  // Dynamic import to avoid breaking non-React contexts
  const React = require('react');
  const { useProjectTranslations } = require('../../../context/ProjectTranslationsContext');

  const { getTranslation } = useProjectTranslations();

  if (!node) return '';

  const guid = node.id || node._id;
  if (!guid) return '';

  // Use Translations if available, otherwise fallback to node.label
  return getTranslation(guid) || node.label || node.name || '';
}



