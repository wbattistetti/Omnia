import React from 'react';
import { getEscalationsFromStep } from '@responseEditor/utils/stepHelpers';
import { stepMeta } from '@responseEditor/ddtUtils';

export interface StepTreeItem {
  stepKey: string;
  isRoot: boolean;
  escalations: any[];
  meta: {
    icon: React.ReactElement | null;
    color: string;
    border: string;
    bg: string;
  };
}

/**
 * Costruisce la gerarchia step → escalation per la vista ad albero
 */
export function buildStepTree(node: any, stepKeys: string[]): StepTreeItem[] {
  if (!node || !stepKeys.length) return [];

  return stepKeys.map((stepKey, index) => {
    const escalations = getEscalationsFromStep(node, stepKey);
    const meta = stepMeta[stepKey] || {
      icon: null,
      color: '#fb923c',
      border: '#fb923c',
      bg: 'rgba(251,146,60,0.08)'
    };

    return {
      stepKey,
      isRoot: index === 0, // Primo step è root
      escalations,
      meta: {
        icon: meta.icon,
        color: meta.color,
        border: meta.border,
        bg: meta.bg
      }
    };
  });
}

/**
 * Normalizza stepKeys in ordine corretto
 */
export function normalizeStepKeys(stepKeys: string[]): string[] {
  const order = ['start', 'introduction', 'noInput', 'noMatch', 'confirmation', 'notConfirmed', 'invalid', 'success'];
  const ordered: string[] = [];
  const unordered: string[] = [];

  // Aggiungi step ordinati
  order.forEach(key => {
    if (stepKeys.includes(key)) {
      ordered.push(key);
    }
  });

  // Aggiungi step non ordinati (constraint, ecc.)
  stepKeys.forEach(key => {
    if (!order.includes(key) && !ordered.includes(key)) {
      unordered.push(key);
    }
  });

  return [...ordered, ...unordered];
}
