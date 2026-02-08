// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { VarsTreeAct } from '../domain/variablesDomain';

export type NavEntry = {
  key: string;
  kind: 'act' | 'main' | 'sub' | 'token';
  token?: string;
  act?: string;
  main?: string;
  sub?: string;
};

export interface BuildNavigationEntriesResult {
  entries: NavEntry[];
  navIndexByKey: Map<string, number>;
}

/**
 * Service for managing variables intellisense navigation and token insertion.
 */
export class VariablesIntellisenseService {
  /**
   * Builds navigation entries from a variables tree with expansion state.
   * Includes act rows so Enter toggles expansion.
   */
  buildNavigationEntries(
    tree: VarsTreeAct[] | undefined,
    filteredTreeActs: VarsTreeAct[],
    filteredVarsForMenu: string[],
    expandedActs: Record<string, boolean>,
    expandedMains: Record<string, boolean>
  ): BuildNavigationEntriesResult {
    const entries: NavEntry[] = [];
    const indexByKey = new Map<string, number>();

    if (tree && tree.length > 0) {
      filteredTreeActs.forEach(act => {
        // Act row always visible
        entries.push({ key: `ACT::${act.label}`, kind: 'act', act: act.label });
        indexByKey.set(`ACT::${act.label}`, entries.length - 1);

        // Visible mains only when act expanded
        if (expandedActs[act.label]) {
          (act.mains || []).forEach(m => {
            entries.push({
              key: `${act.label}.${m.label}`,
              kind: 'main',
              token: `${act.label}.${m.label}`,
              act: act.label,
              main: m.label
            });
            indexByKey.set(`${act.label}.${m.label}`, entries.length - 1);

            // Visible subs only when main expanded
            if (expandedMains[`${act.label}::${m.label}`]) {
              (m.subs || []).forEach(s => {
                const k = `${act.label}.${m.label}.${s.label}`;
                entries.push({
                  key: k,
                  kind: 'sub',
                  token: k,
                  act: act.label,
                  main: m.label,
                  sub: s.label
                });
                indexByKey.set(k, entries.length - 1);
              });
            }
          });
        }
      });
    } else {
      filteredVarsForMenu.forEach(k => {
        entries.push({ key: k, kind: 'token', token: k });
        indexByKey.set(k, entries.length - 1);
      });
    }

    return { entries, navIndexByKey: indexByKey };
  }

  /**
   * Inserts a variable token at the caret position in a script textarea.
   * Returns the new script and updated caret position.
   */
  insertVariableTokenInScript(
    varKey: string,
    currentScript: string,
    caret: { start: number; end: number }
  ): { newScript: string; newCaret: { start: number; end: number } } {
    const token = `vars["${varKey}"]`;
    const caretStart = caret.start ?? currentScript.length;
    const caretEnd = caret.end ?? caretStart;
    const next = currentScript.slice(0, caretStart) + token + currentScript.slice(caretEnd);
    const pos = caretStart + token.length;

    return {
      newScript: next,
      newCaret: { start: pos, end: pos }
    };
  }

  /**
   * Inserts a variable token into a contentEditable element.
   * Uses execCommand for undo/redo support.
   */
  insertVariableTokenInContentEditable(
    varKey: string,
    element: HTMLElement,
    serializeCallback: () => string
  ): void {
    try {
      element.focus();
      const token = `{${varKey}}`;
      const html = `<span data-token="1" contenteditable="false" style="padding:2px 6px;border-radius:6px;border:1px solid #38bdf8;background:rgba(56,189,248,0.15);color:#e5e7eb;font-weight:700;">${token}</span>&nbsp;`;
      // eslint-disable-next-line deprecation/deprecation
      document.execCommand('insertHTML', false, html);
      serializeCallback();
    } catch (e) {
      console.warn('[VariablesIntellisenseService] Failed to insert token in contentEditable:', e);
    }
  }
}
