/**
 * Active Tutor — modulo attenzione visiva (blink×2 + bordo persistente per spiegazioni Tutor).
 */

import { tutorDomSelector } from './uiIds';

export type AttentionEffectType = 'blink' | 'pulse' | 'highlight' | 'shake' | 'glow';

export interface AttentionTriggerOptions {
  elementId: string;
  type: AttentionEffectType;
  duration?: number;
  cycles?: number;
  color?: string;
}

const ATTENTION_CLASS_PREFIX = 'omnia-tutor-attention-';
const DEFAULT_DURATION_MS = 2400;
const BLINK_TWICE_MS = 1200;

let activeCleanup: (() => void) | null = null;
let persistentElement: HTMLElement | null = null;

function resolveElement(elementId: string): HTMLElement | null {
  return document.querySelector(tutorDomSelector(elementId));
}

function clearPersistent(): void {
  if (persistentElement) {
    persistentElement.classList.remove('omnia-tutor-attention-persistent');
    persistentElement = null;
  }
}

function applyAttentionClasses(
  el: HTMLElement,
  type: AttentionEffectType,
  color?: string,
  cycles?: number
): void {
  el.classList.add(`${ATTENTION_CLASS_PREFIX}${type}`);
  if (color) el.style.setProperty('--omnia-tutor-attention-color', color);
  if (cycles != null && type === 'glow') {
    el.style.setProperty('--omnia-tutor-glow-cycles', String(cycles));
  }
}

function removeAttentionClasses(el: HTMLElement, type: AttentionEffectType): void {
  el.classList.remove(`${ATTENTION_CLASS_PREFIX}${type}`);
  el.classList.remove('omnia-tutor-attention-blink-twice');
  el.style.removeProperty('--omnia-tutor-attention-color');
  el.style.removeProperty('--omnia-tutor-glow-cycles');
}

function attachDismissOnInteraction(el: HTMLElement, type: AttentionEffectType): () => void {
  const dismiss = (): void => {
    removeAttentionClasses(el, type);
    clearPersistent();
    el.removeEventListener('click', dismiss);
    el.removeEventListener('input', dismiss);
    el.removeEventListener('keydown', dismiss);
    el.removeEventListener('pointerdown', dismiss, true);
    if (activeCleanup === dismiss) activeCleanup = null;
  };
  el.addEventListener('click', dismiss, { once: true });
  el.addEventListener('input', dismiss, { once: true });
  el.addEventListener('keydown', dismiss, { once: true });
  el.addEventListener('pointerdown', dismiss, { capture: true, once: true });
  return dismiss;
}

/** Disattiva qualsiasi effetto attenzione corrente. */
export function attentionDismiss(): void {
  activeCleanup?.();
  activeCleanup = null;
  clearPersistent();
}

/**
 * Spiegazione Tutor: blink ×2 poi bordo persistente finché non dismissed.
 */
export function attentionExplainElement(
  elementId: string,
  type: AttentionEffectType = 'blink'
): boolean {
  const el = resolveElement(elementId);
  if (!el) return false;

  attentionDismiss();

  el.classList.add('omnia-tutor-attention-blink-twice');
  window.setTimeout(() => {
    el.classList.remove('omnia-tutor-attention-blink-twice');
    el.classList.add('omnia-tutor-attention-persistent');
    persistentElement = el;
  }, BLINK_TWICE_MS);

  if (type !== 'blink') {
    applyAttentionClasses(el, type);
    window.setTimeout(() => removeAttentionClasses(el, type), BLINK_TWICE_MS);
  }

  const dismiss = attachDismissOnInteraction(el, type);
  activeCleanup = dismiss;
  return true;
}

export function attentionTrigger(options: AttentionTriggerOptions): boolean {
  const el = resolveElement(options.elementId);
  if (!el) return false;

  attentionDismiss();

  const type = options.type;
  applyAttentionClasses(el, type, options.color, options.cycles);
  const dismiss = attachDismissOnInteraction(el, type);
  activeCleanup = dismiss;

  const duration = options.duration ?? DEFAULT_DURATION_MS;
  window.setTimeout(() => {
    if (activeCleanup === dismiss) {
      dismiss();
    }
  }, duration);

  return true;
}

export const attention = {
  trigger: attentionTrigger,
  dismiss: attentionDismiss,
  explain: attentionExplainElement,
  blink: (elementId: string, opts?: Omit<AttentionTriggerOptions, 'elementId' | 'type'>) =>
    attentionTrigger({ elementId, type: 'blink', ...opts }),
  pulse: (elementId: string, opts?: Omit<AttentionTriggerOptions, 'elementId' | 'type'>) =>
    attentionTrigger({ elementId, type: 'pulse', ...opts }),
  highlight: (elementId: string, opts?: Omit<AttentionTriggerOptions, 'elementId' | 'type'>) =>
    attentionTrigger({ elementId, type: 'highlight', ...opts }),
  shake: (elementId: string, opts?: Omit<AttentionTriggerOptions, 'elementId' | 'type'>) =>
    attentionTrigger({ elementId, type: 'shake', ...opts }),
  glow: (elementId: string, opts?: Omit<AttentionTriggerOptions, 'elementId' | 'type'>) =>
    attentionTrigger({ elementId, type: 'glow', ...opts }),
};
