/**
 * Stable React context instance for project translations (types + hook live here).
 * Kept separate from ProjectTranslationsProvider so Vite HMR reloading the provider file
 * does not call createContext() again and break consumers (stale Provider vs new hook).
 */
import { createContext, useContext } from 'react';

const LOG_PREFIX = '[ProjectTranslations]';

/** Esportato per log nel Provider; in console: `window.__omniaDebugProjectTranslations = true` anche in build non-DEV. */
export function isProjectTranslationsDebugEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && (window as unknown as { __omniaDebugProjectTranslations?: boolean }).__omniaDebugProjectTranslations === true)
  );
}

/** DEV: se questo file viene valutato più di una volta, spesso ci sono due copie del bundle (context diverso dal Provider). */
if (typeof window !== 'undefined') {
  const w = window as unknown as { __omniaPtContextModuleLoads?: number };
  w.__omniaPtContextModuleLoads = (w.__omniaPtContextModuleLoads ?? 0) + 1;
  if (isProjectTranslationsDebugEnabled() && w.__omniaPtContextModuleLoads > 1) {
    console.warn(
      `${LOG_PREFIX} projectTranslationsContextInstance.ts valutato più volte (count=${w.__omniaPtContextModuleLoads}). Possibile doppio bundle / HMR incoerente — prova hard refresh (Ctrl+Shift+R).`
    );
  }
}

if (isProjectTranslationsDebugEnabled()) {
  console.debug(`${LOG_PREFIX} modulo context caricato`, { url: import.meta.url });
}

export interface ProjectTranslationsContextType {
  translations: Record<string, string>;
  /**
   * Single merged map for runtime (Test, Chat, orchestrator): global locale + all `flows[*].meta.translations`;
   * flow keys override global on conflict. Prefer this over `translations` for execution paths.
   */
  compiledTranslations: Record<string, string>;
  /** Increments when strings are written only to flow slice `meta.translations` (use with getTranslation). */
  flowTranslationRevision: number;
  addTranslation: (guid: string, text: string, templateId?: string) => void;
  addTranslations: (translations: Record<string, string>, templateId?: string) => void;
  getTranslation: (guid: string) => string | undefined;
  loadAllTranslations: () => Promise<void>;
  saveAllTranslations: () => Promise<void>;
  /** Kept for API compatibility; persistence no longer uses dirty tracking (always false). */
  isDirty: boolean;
  isLoading: boolean;
  isReady: boolean;
  setCurrentTemplateId: (templateId: string | null) => void;
}

export const ProjectTranslationsContext = createContext<ProjectTranslationsContextType | undefined>(undefined);

export function useProjectTranslations(): ProjectTranslationsContextType {
  const context = useContext(ProjectTranslationsContext);
  if (context === undefined) {
    if (isProjectTranslationsDebugEnabled()) {
      const w = typeof window !== 'undefined' ? (window as unknown as { __omniaPtContextModuleLoads?: number }) : undefined;
      console.error(`${LOG_PREFIX} useProjectTranslations: context undefined (nessun Provider sopra questo consumer).`, {
        contextModuleUrl: import.meta.url,
        ptContextModuleLoads: w?.__omniaPtContextModuleLoads,
        hint: 'Se compare dopo salvataggio/HMR: hard refresh. Se sempre: Provider non avvolge il componente o import duplicato del context.',
        stack: new Error().stack,
      });
    }
    throw new Error('useProjectTranslations must be used within a ProjectTranslationsProvider');
  }
  return context;
}
