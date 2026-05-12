/**
 * Single source of truth for "no AI model selected" UX flow.
 *
 * When the designer triggers an AI action without having picked a model in Omnia Tutor:
 *   1. The action MUST NOT call any LLM (no silent fallback in the backend either).
 *   2. The Settings -> Omnia Tutor page is opened (option B agreed with the user).
 *   3. A banner is shown at the top of that page so the designer immediately sees the cause.
 *   4. The local CTA shows the inline `MissingAiModelToast` to confirm the action was blocked.
 *
 * The Studio page reads `consumeMissingAiModelReason()` once and then clears the flag.
 */
import {
  OMNIA_OPEN_STUDIO_SETTINGS_EVENT,
  type OmniaOpenStudioSettingsEventDetail,
} from '../BackendBuilder/state/BackendBuilderContext';

/** Session-storage key used to hand off the "missing model" reason to the Omnia Tutor page. */
export const MISSING_AI_MODEL_REASON_STORAGE_KEY = 'omnia.aiModel.missingReason';

/**
 * Open Settings -> Omnia Tutor with the missing-model reason banner.
 * Safe to call from any UI context (CTA click handler, error handler, etc.).
 */
export function openOmniaTutorForMissingModel(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(MISSING_AI_MODEL_REASON_STORAGE_KEY, 'missing-ai-model');
    }
  } catch {
    /* sessionStorage unavailable (private mode, SSR): the event detail still carries the reason */
  }
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent<OmniaOpenStudioSettingsEventDetail>(OMNIA_OPEN_STUDIO_SETTINGS_EVENT, {
      detail: { step: 'omniaTutor', reason: 'missing-ai-model' },
      bubbles: true,
    })
  );
}

/**
 * Read and clear the missing-model reason flag set by {@link openOmniaTutorForMissingModel}.
 * Returns `true` exactly once when the page should display the banner.
 */
export function consumeMissingAiModelReason(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const value = window.sessionStorage.getItem(MISSING_AI_MODEL_REASON_STORAGE_KEY);
    if (value === 'missing-ai-model') {
      window.sessionStorage.removeItem(MISSING_AI_MODEL_REASON_STORAGE_KEY);
      return true;
    }
  } catch {
    /* sessionStorage unavailable: nothing to consume */
  }
  return false;
}
