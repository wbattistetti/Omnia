import type { DDTNode } from '../DialogueDataEngine/model/ddt.v2.types';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
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
  const mains = Array.isArray((currentDDT as any)?.data)
    ? (currentDDT as any).data
    : (currentDDT as any)?.data ? [(currentDDT as any).data] : [];

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

// Italian month names for formatting
const ITALIAN_MONTHS: Record<number, string> = {
  1: 'gennaio', 2: 'febbraio', 3: 'marzo', 4: 'aprile',
  5: 'maggio', 6: 'giugno', 7: 'luglio', 8: 'agosto',
  9: 'settembre', 10: 'ottobre', 11: 'novembre', 12: 'dicembre'
};

// Helper to summarize a value from state memory with smart formatting
export function summarizeValue(state: any, main: DDTNode | undefined): string {
  if (!main) return '';
  const v = state?.memory?.[main.id]?.value;
  if (!v) return '';

  // If it's a string, return as-is
  if (typeof v === 'string') return v;

  // If it's not an object, convert to string
  if (typeof v !== 'object' || v === null) return String(v);

  try {
    // Check if it's a date object with standard keys (day, month, year)
    if ('day' in v || 'month' in v || 'year' in v) {
      const day = v.day;
      const month = v.month;
      const year = v.year;

      const parts: string[] = [];
      if (day !== undefined && day !== null) parts.push(String(day));
      if (month !== undefined && month !== null) {
        const monthNum = typeof month === 'number' ? month : parseInt(String(month), 10);
        if (!Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          parts.push(ITALIAN_MONTHS[monthNum] || String(monthNum));
        } else {
          parts.push(String(month));
        }
      }
      if (year !== undefined && year !== null) parts.push(String(year));

      return parts.length > 0 ? parts.join(' ') : '';
    }

    // Check if it's a name object with standard keys (firstname, lastname)
    if ('firstname' in v || 'lastname' in v) {
      const parts: string[] = [];
      if (v.firstname) parts.push(String(v.firstname));
      if (v.lastname) parts.push(String(v.lastname));
      return parts.join(' ');
    }

    // If object has sub-IDs as keys, try to map them to readable format
    // This happens when value is composed from subs in engine.ts
    if (main && Array.isArray(main.subs) && main.subs.length > 0) {
      const parts: string[] = [];
      const seenSubIds = new Set<string>();

      // Check if any sub has day/month/year semantics
      for (const subId of main.subs) {
        if (seenSubIds.has(subId)) continue;
        const sub = state?.plan?.byId?.[subId];
        if (!sub) continue;

        const subValue = v[subId];
        if (subValue === undefined || subValue === null) continue;

        const labelNorm = String(sub?.label || '').toLowerCase();

        // Map based on sub label semantics
        if (main.kind === 'date') {
          if (labelNorm.includes('day') || labelNorm.includes('giorno')) {
            parts.push(String(subValue));
            seenSubIds.add(subId);
          } else if (labelNorm.includes('month') || labelNorm.includes('mese')) {
            const monthNum = typeof subValue === 'number' ? subValue : parseInt(String(subValue), 10);
            if (!Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
              parts.push(ITALIAN_MONTHS[monthNum] || String(subValue));
            } else {
              parts.push(String(subValue));
            }
            seenSubIds.add(subId);
          } else if (labelNorm.includes('year') || labelNorm.includes('anno')) {
            parts.push(String(subValue));
            seenSubIds.add(subId);
          }
        } else {
          // For non-date types, just add the value
          parts.push(String(subValue));
          seenSubIds.add(subId);
        }
      }

      if (parts.length > 0) {
        return parts.join(' ');
      }
    }

    // Fallback: join all non-empty values
    return Object.values(v).filter(Boolean).join(' ');
  } catch (e) {
    return '';
  }
}

// Resolve ask message for a node
export function resolveAsk(
  node?: DDTNode,
  sub?: DDTNode,
  translations?: Record<string, string>,
  legacyDict?: Record<string, string>,
  legacyNode?: any,
  legacySub?: any
): { text: string; key?: string; stepType?: 'start' | 'ask' } {
  try {
    const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';

    // Merge translations with legacyDict upfront for consistent usage
    const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };

    if (debugEnabled) {
      console.log('[resolveAsk][START]', {
        hasNode: !!node,
        hasSub: !!sub,
        hasLegacyNode: !!legacyNode,
        hasLegacySub: !!legacySub,
        nodeKind: node?.kind,
        legacyNodeKind: legacyNode?.kind,
        nodeSteps: node?.steps ? Object.keys(node.steps) : [],
        legacyNodeSteps: legacyNode?.steps ? Object.keys(legacyNode.steps) : []
      });
    }

    // Try legacy deref first - this works for both intent (start) and data extraction
    // For intent, this will find steps.start; for data, it may find steps.start or fall through to ask
    if (legacyNode || legacySub) {
      const targetNode = legacySub || legacyNode;
      const actions = getEscalationActions(targetNode, 'start', 1);

      if (debugEnabled) {
        console.log('[resolveAsk][LEGACY_START]', {
          targetNodeKind: targetNode?.kind,
          targetNodeSteps: targetNode?.steps ? Object.keys(targetNode.steps) : [],
          actionsCount: actions.length,
          actions: actions.map((a: any) => ({
            actionId: a?.actionId,
            hasText: !!a?.text,
            textLength: a?.text?.length || 0,
            parameters: a?.parameters?.map((p: any) => ({ id: p?.parameterId || p?.key, value: p?.value?.substring(0, 50) }))
          }))
        });
      }

      for (const a of actions) {
        // Use mergedTranslations instead of just legacyDict
        const txt = resolveActionText(a, mergedTranslations);

        if (debugEnabled) {
          const textParam = a?.parameters?.find((p: any) => (p?.parameterId || p?.key) === 'text');
          console.log('[resolveAsk][ACTION_RESOLVE]', {
            actionId: a?.actionId,
            hasActionText: !!a?.text,
            actionText: a?.text?.substring(0, 50),
            textParam: textParam ? {
              parameterId: textParam.parameterId || textParam.key,
              value: textParam.value?.substring(0, 50),
              valueType: typeof textParam.value,
              isKey: !!mergedTranslations[textParam.value]
            } : null,
            resolvedText: txt?.substring(0, 100),
            hasResolvedText: !!txt,
            mergedTranslationsKeys: Object.keys(mergedTranslations).slice(0, 10),
            actionFull: JSON.stringify(a, null, 2).substring(0, 500)
          });
        }

        if (txt) {
          const textKey = a?.parameters?.find((p: any) => p?.parameterId === 'text' || p?.key === 'text')?.value;
          const result = { text: txt, key: textKey || a?.parameters?.[0]?.value, stepType: 'start' as const };

          if (debugEnabled) {
            console.log('[resolveAsk][SUCCESS_START]', {
              textLength: txt.length,
              textPreview: txt.substring(0, 100),
              key: result.key,
              stepType: result.stepType
            });
          }

          return result;
        }
      }
    }
    // Fallback to V2 format (steps.ask.base) for data extraction
    if (sub) {
      const key = sub?.steps?.ask?.base;
      // Use translations directly like StepEditor does: translations[key] || key
      const text = typeof key === 'string' ? (mergedTranslations[key] || key) : '';

      if (debugEnabled) {
        console.log('[resolveAsk][V2_SUB]', {
          key,
          textLength: text.length,
          textPreview: text.substring(0, 100),
          hasTranslation: !!mergedTranslations[key]
        });
      }

      return { text, key, stepType: 'ask' };
    }
    if (node) {
      const key = node?.steps?.ask?.base;
      // Use translations directly like StepEditor does: translations[key] || key
      const text = typeof key === 'string' ? (mergedTranslations[key] || key) : '';

      if (debugEnabled) {
        console.log('[resolveAsk][V2_NODE]', {
          key,
          textLength: text.length,
          textPreview: text.substring(0, 100),
          hasTranslation: !!mergedTranslations[key]
        });
      }

      return { text, key, stepType: 'ask' };
    }

    // No fallback hardcoded - return empty if no key found
    if (debugEnabled) {
      console.warn('[resolveAsk][EMPTY]', {
        reason: 'No legacy node, no sub, no node - returning empty'
      });
    }

    return { text: '', key: undefined, stepType: 'ask' };
  } catch (err) {
    console.error('[resolveAsk][ERROR]', err);
    return { text: '', key: undefined, stepType: 'ask' };
  }
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
      if (txt) {
        // 🆕 Replace {input} placeholder in legacy messages too
        const summary = summarizeValue(state, node);
        const trimmed = String(summary || '').trim();
        const finalTxt = trimmed ? txt.replace(/{input}/g, trimmed) : txt;
        return { text: finalTxt, key: a?.parameters?.[0]?.value };
      }
    }
  }
  // Merge translations with legacyDict to ensure all configured prompts are available
  const mergedTranslations = { ...(legacyDict || {}), ...(translations || {}) };
  const key = node?.steps?.confirm?.base;
  // Use translations directly like StepEditor does: translations[key] || key
  const resolvedText = typeof key === 'string' ? (mergedTranslations[key] || key) : '';

  // 🆕 Extract value and replace {input} placeholder in the message
  const summary = summarizeValue(state, node);
  const trimmed = String(summary || '').trim();

  if (resolvedText && resolvedText !== key) {
    // If message contains {input}, replace it with the formatted value
    if (resolvedText.includes('{input}')) {
      const finalText = trimmed ? resolvedText.replace(/{input}/g, trimmed) : resolvedText.replace(/{input}/g, '');
      return { text: finalText, key };
    }
    // Legacy behavior: prepend value if no {input} placeholder (backward compatibility)
    return { text: trimmed ? `${trimmed}. ${resolvedText}` : resolvedText, key };
  }

  // If no translation found, return empty or key itself
  if (key) {
    const fallbackText = mergedTranslations[key] || key;
    // Replace {input} if present
    const finalText = trimmed && fallbackText.includes('{input}')
      ? fallbackText.replace(/{input}/g, trimmed)
      : (trimmed ? `${trimmed}. ${fallbackText}` : fallbackText);
    return { text: finalText, key };
  }

  return { text: '', key: undefined };
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

