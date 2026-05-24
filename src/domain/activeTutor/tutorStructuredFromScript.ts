/**
 * Active Tutor — converte script deterministici in TutorStructuredMessage completo (uiRefs multipli).
 */

import type {
  TutorAttentionType,
  TutorStructuredAction,
  TutorStructuredMessage,
  TutorStructuredUiRef,
} from './tutorStructuredMessage';
import { allTutorUiIds } from './tutorUiIds';

/** Input script (stesso shape di TutorScriptMessage, senza import circolare). */
export interface TutorScriptMessageInput {
  readonly text: string;
  readonly attentionTargetId?: string;
  readonly attentionType?: 'blink' | 'pulse' | 'highlight' | 'glow';
  readonly uiActions?: ReadonlyArray<{
    action: 'openTab' | 'openPanel' | 'expandSection' | 'focus' | 'scrollTo';
    targetId: string;
  }>;
}

const ALLOWED = allTutorUiIds();

function normalizeAttentionType(
  raw?: TutorScriptMessageInput['attentionType']
): TutorAttentionType {
  if (raw === 'highlight') return 'glow';
  if (raw === 'blink' || raw === 'pulse' || raw === 'glow') return raw;
  return 'glow';
}

function humanLabelForElementId(elementId: string): string {
  if (elementId.startsWith('wizard-step-')) {
    const n = parseInt(elementId.replace('wizard-step-', ''), 10);
    return Number.isInteger(n) ? `Passo ${n + 1}` : elementId;
  }
  return elementId.replace(/-/g, ' ');
}

/**
 * Espande uiActions + attentionTargetId in uiRefs[] deduplicati (whitelist).
 */
export function tutorStructuredFromScriptMessage(
  script: TutorScriptMessageInput,
  title: string,
  extraActions: readonly TutorStructuredAction[] = []
): TutorStructuredMessage {
  const uiRefsMap = new Map<string, TutorStructuredUiRef>();
  const attentionType = normalizeAttentionType(script.attentionType);

  const addRef = (elementId: string, type: TutorAttentionType, label?: string): void => {
    if (!ALLOWED.has(elementId)) return;
    const existing = uiRefsMap.get(elementId);
    if (existing) return;
    uiRefsMap.set(elementId, {
      elementId,
      label: label ?? humanLabelForElementId(elementId),
      type,
    });
  };

  if (script.attentionTargetId) {
    addRef(script.attentionTargetId, attentionType);
  }

  for (const ua of script.uiActions ?? []) {
    const targetId = ua.targetId.trim();
    if (!targetId) continue;
    if (targetId.startsWith('wizard-step-') || ALLOWED.has(targetId)) {
      addRef(targetId, attentionType);
    }
  }

  const actions: TutorStructuredAction[] = [...extraActions];
  for (const ua of script.uiActions ?? []) {
    if (ua.action === 'openTab' && ALLOWED.has(ua.targetId)) {
      actions.push({
        icon: 'ArrowRight',
        label: `Vai a ${humanLabelForElementId(ua.targetId)}`,
        kind: 'navigate',
        elementId: ua.targetId,
        type: 'glow',
      });
    }
  }

  return {
    title: title.trim() || 'Tutor',
    body: script.text.trim(),
    actions,
    uiRefs: [...uiRefsMap.values()],
    ensureView: null,
  };
}
