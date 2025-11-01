import type { DDTNode } from '../../../../DialogueDataEngine/model/ddt.v2.types';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { getEscalationActions, resolveActionText } from './DDTAdapter';

// Helper function to find the last available escalation level
export function findLastAvailableEscalation(
  legacyNode: any,
  stepType: 'noMatch' | 'noInput',
  maxLevel: number,
  legacyDict: Record<string, string>,
  translations?: Record<string, string>
): { text: string; key?: string; level: number } {
  // Prova a trovare escalation partendo dal livello richiesto fino a 1
  for (let level = maxLevel; level >= 1; level--) {
    const actions = getEscalationActions(legacyNode, stepType, level);
    if (actions.length > 0) {
      const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
      const txt = resolveActionText(actions[0], mergedTranslations);
      const textKey = actions[0]?.parameters?.[0]?.value;
      if (txt) {
        return { text: txt, key: textKey, level };
      }
    }
  }
  return { text: '', key: undefined, level: 0 };
}

// Helper function to resolve escalation messages from escalations structure (like StepEditor)
export function resolveEscalation(
  legacyNode: any,
  stepType: 'noMatch' | 'noInput',
  escalationLevel: number,
  legacyDict: Record<string, string>,
  translations?: Record<string, string>
): { text: string; key?: string; level: number } {
  if (!legacyNode) {
    return { text: '', key: undefined, level: 0 };
  }

  // Prima prova con escalationLevel richiesto
  const actions = getEscalationActions(legacyNode, stepType, escalationLevel);

  if (actions.length > 0) {
    const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
    const txt = resolveActionText(actions[0], mergedTranslations);
    const textKey = actions[0]?.parameters?.[0]?.value;
    if (txt) {
      return { text: txt, key: textKey, level: escalationLevel };
    }
  }

  // Se non trova escalation al livello richiesto, cerca l'ultima disponibile (più alta)
  const result = findLastAvailableEscalation(legacyNode, stepType, escalationLevel, legacyDict, translations);
  return result;
}

// Helper functions to get main/sub nodes from simulator state
export function getMain(state: any): DDTNode | undefined {
  const id = state?.plan?.order?.[state?.currentIndex];
  return state?.plan?.byId?.[id];
}

export function getSub(state: any): DDTNode | undefined {
  const sid = state?.currentSubId;
  return sid ? state?.plan?.byId?.[sid] : undefined;
}

// Helper to find the original node from currentDDT by label/id to get nlpProfile
export function findOriginalNode(currentDDT: AssembledDDT, nodeLabel?: string, nodeId?: string): any {
  if (!currentDDT) return undefined;
  const mains = Array.isArray((currentDDT as any)?.mainData)
    ? (currentDDT as any).mainData
    : (currentDDT as any)?.mainData ? [(currentDDT as any).mainData] : [];

  for (const main of mains) {
    if (!main) continue;
    // Check main node
    if ((nodeLabel && main.label === nodeLabel) || (nodeId && main.id === nodeId)) {
      return main;
    }
    // Check sub nodes
    if (Array.isArray(main.subData)) {
      for (const sub of main.subData) {
        if ((nodeLabel && sub.label === nodeLabel) || (nodeId && sub.id === nodeId)) {
          return sub;
        }
      }
    }
  }
  return undefined;
}

// Helper to summarize a value from state memory
export function summarizeValue(state: any, main: DDTNode | undefined): string {
  if (!main) return '';
  const v = state?.memory?.[main.id]?.value;
  if (!v) return '';
  if (typeof v === 'string') return v;
  try { return Object.values(v).filter(Boolean).join(' '); } catch { return ''; }
}

// Resolve ask message for a node
export function resolveAsk(
  node?: DDTNode,
  sub?: DDTNode,
  translations?: Record<string, string>,
  legacyDict?: Record<string, string>,
  legacyNode?: any,
  legacySub?: any
): { text: string; key?: string } {
  // Try legacy deref first (exact same as legacy simulator)
  if (legacyNode) {
    const actions = getEscalationActions(legacySub || legacyNode, 'start', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) {
        // eslint-disable-next-line no-console
        return { text: txt, key: a?.parameters?.[0]?.value };
      }
    }
  }
  // Merge translations with legacyDict to ensure all configured prompts are available
  const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
  if (sub) {
    const key = sub?.steps?.ask?.base;
    // Use translations directly like StepEditor does: translations[key] || key
    const text = typeof key === 'string' ? (mergedTranslations[key] || key) : '';
    return { text, key };
  }
  if (node) {
    const key = node?.steps?.ask?.base;
    // Use translations directly like StepEditor does: translations[key] || key
    const text = typeof key === 'string' ? (mergedTranslations[key] || key) : '';
    return { text, key };
  }
  // No fallback hardcoded - return empty if no key found
  return { text: '', key: undefined };
}

// Resolve confirmation message for a node
export function resolveConfirm(
  state: any,
  node?: DDTNode,
  legacyDict?: Record<string, string>,
  legacyNode?: any,
  translations?: Record<string, string>
): { text: string; key?: string } {
  if (!node) return { text: '', key: undefined };
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'confirmation', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return { text: txt, key: a?.parameters?.[0]?.value };
    }
  }
  // Merge translations with legacyDict to ensure all configured prompts are available
  const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
  const key = node?.steps?.confirm?.base;
  // Use translations directly like StepEditor does: translations[key] || key
  const resolvedText = typeof key === 'string' ? (mergedTranslations[key] || key) : '';
  if (resolvedText && resolvedText !== key) {
    const summary = summarizeValue(state, node);
    const trimmed = String(summary || '').trim();
    return { text: trimmed ? `${trimmed}. ${resolvedText}` : resolvedText, key };
  }
  // If no translation found, return empty or key itself
  const summary = summarizeValue(state, node);
  const trimmed = String(summary || '').trim();
  const finalText = trimmed && key ? `${trimmed}. ${mergedTranslations[key] || key}` : (key ? mergedTranslations[key] || key : '');
  // eslint-disable-next-line no-console
  return { text: finalText, key };
}

// Resolve success message for a node
export function resolveSuccess(
  node?: DDTNode,
  translations?: Record<string, string>,
  legacyDict?: Record<string, string>,
  legacyNode?: any
): { text: string; key?: string } {
  if (!node) return { text: '', key: undefined };
  // Legacy deref first
  if (legacyNode) {
    const actions = getEscalationActions(legacyNode, 'success', 1);
    for (const a of actions) {
      const txt = resolveActionText(a, legacyDict || {});
      if (txt) return { text: txt, key: a?.parameters?.[0]?.value };
    }
  }
  // Merge translations with legacyDict to ensure all configured prompts are available
  const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
  const key = node?.steps?.success?.base?.[0];
  // Use translations directly like StepEditor does: translations[key] || key
  const resolved = typeof key === 'string' ? (mergedTranslations[key] || key) : '';
  return { text: resolved, key };
}

