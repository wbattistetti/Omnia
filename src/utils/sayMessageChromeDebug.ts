/**
 * Opt-in diagnostics for SayMessage tab close → flowchart row chrome (icon color via instanceRepository:updated).
 *
 * DevTools:
 *   localStorage.setItem('omnia.debug.sayMessageChrome', '1')
 * Disable:
 *   localStorage.removeItem('omnia.debug.sayMessageChrome')
 *
 * Logs:
 * - `[Omnia][SayMessageChrome]` — editor unmount flush + event dispatch
 * - `[Omnia][SayMessageChrome]` — NodeRow listener match / skip (instanceId vs row)
 *
 * Note: `[Omnia][hydrateVariablesFromFlow]` with `utteranceTaskRowsHydrated: 0` is variable-store hydration;
 * it is unrelated to Say message text / icon refresh — use `omnia.variableHydrationDebug` (see variableMenuDebug.ts).
 */

export function isSayMessageChromeDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('omnia.debug.sayMessageChrome') === '1';
  } catch {
    return false;
  }
}

export function logSayMessageChrome(
  scope: 'editorUnmount' | 'nodeRowListener',
  payload: Record<string, unknown>
): void {
  if (!isSayMessageChromeDebugEnabled()) return;
  try {
    console.info(`[Omnia][SayMessageChrome][${scope}]`, payload);
  } catch {
    /* noop */
  }
}
