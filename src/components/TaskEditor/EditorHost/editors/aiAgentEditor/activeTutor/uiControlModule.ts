/**
 * Active Tutor — controllo programmatico dell'interfaccia (tab, pannelli, focus, scroll).
 */

import { tutorDomSelector } from './uiIds';

export type UiControlAction = 'openTab' | 'openPanel' | 'expandSection' | 'focus' | 'scrollTo';

export interface UiControlPerformOptions {
  action: UiControlAction;
  targetId: string;
}

/** Evento custom per azioni che richiedono integrazione React (es. cambio step wizard). */
export const TUTOR_UI_CONTROL_EVENT = 'omnia-tutor-ui-control';

export interface TutorUiControlEventDetail {
  action: UiControlAction;
  targetId: string;
}

function resolveElement(targetId: string): HTMLElement | null {
  return document.querySelector(tutorDomSelector(targetId));
}

function dispatchHostAction(detail: TutorUiControlEventDetail): void {
  window.dispatchEvent(new CustomEvent(TUTOR_UI_CONTROL_EVENT, { detail }));
}

function performDomAction(action: UiControlAction, el: HTMLElement): void {
  switch (action) {
    case 'focus':
      if ('focus' in el && typeof el.focus === 'function') {
        el.focus({ preventScroll: false });
      }
      break;
    case 'scrollTo':
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;
    case 'openTab':
    case 'openPanel':
    case 'expandSection':
      el.click();
      break;
    default:
      break;
  }
}

/** Esegue un'azione UI sul targetId registrato. */
export function uiControlPerform(options: UiControlPerformOptions): boolean {
  const { action, targetId } = options;

  if (targetId.startsWith('wizard-step-')) {
    dispatchHostAction({ action, targetId });
    return true;
  }

  const el = resolveElement(targetId);
  if (!el) {
    dispatchHostAction({ action, targetId });
    return false;
  }

  performDomAction(action, el);
  return true;
}

/** Guidance idle: focus + glow (non passa dal modulo attention). */
export function uiControlGuidance(targetId: string): boolean {
  const el = resolveElement(targetId);
  if (!el) return false;
  el.classList.add('omnia-tutor-guidance-glow');
  const dismiss = (): void => {
    el.classList.remove('omnia-tutor-guidance-glow');
    el.removeEventListener('click', dismiss);
    el.removeEventListener('input', dismiss);
  };
  el.addEventListener('click', dismiss, { once: true });
  el.addEventListener('input', dismiss, { once: true });
  if ('focus' in el && typeof el.focus === 'function') {
    el.focus({ preventScroll: false });
  }
  return true;
}

export const uiControl = {
  perform: uiControlPerform,
  guidance: uiControlGuidance,
};
