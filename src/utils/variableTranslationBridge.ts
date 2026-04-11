/**
 * Bridges domain code (e.g. subflow auto-rename) to {@link ProjectTranslationsContext} so
 * `var:uuid` labels are persisted on save and survive reload. Plain
 * {@link mergeProjectTranslationEntry} only updates the sync registry; React state must also update.
 */

import { mergeProjectTranslationEntry } from './projectTranslationsRegistry';

type Listener = (canonicalKey: string, text: string) => void;

let listener: Listener | null = null;

/** Called once from ProjectTranslationsProvider mount. */
export function registerVariableTranslationListener(fn: Listener | null): void {
  listener = fn;
}

/**
 * Writes a variable display string under a canonical translation key (e.g. `var:uuid`)
 * and notifies the React translation layer when registered.
 */
export function publishVariableDisplayTranslation(canonicalKey: string, text: string): void {
  mergeProjectTranslationEntry(canonicalKey, text);
  listener?.(canonicalKey, text);
}
