/**
 * Dock panel: per-task runtime IA settings (Response Editor). Tab title is "Agent setup"; panel stays compact (badge + save).
 */

import React from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { IAAgentSetup } from '@components/settings/IAAgentSetup';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { refreshIaCatalog } from '@services/iaCatalogApi';
import { useAIAgentEditorDock } from './AIAgentEditorDockContext';

export function EditorIaRuntimePanel(_props: IDockviewPanelProps) {
  const {
    iaRuntimeConfig,
    setIaRuntimeConfig,
    iaRuntimeLoadedFrom,
    saveIaRuntimeOverrideToTask,
  } = useAIAgentEditorDock();
  const baseline = React.useMemo(() => loadGlobalIaAgentConfig(), []);
  const [catalogBusy, setCatalogBusy] = React.useState(false);
  const [catalogMsg, setCatalogMsg] = React.useState<string | null>(null);
  const [catalogReloadNonce, setCatalogReloadNonce] = React.useState(0);

  const loadedTitle =
    iaRuntimeLoadedFrom === 'saved_override'
      ? 'Parametri persistiti sul task (override).'
      : 'Default globali (Impostazioni → Runtime IA Agent); Salva per creare override sul task.';

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-1 bg-violet-950/15 p-1.5 border-l-4 border-violet-500/45">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            iaRuntimeLoadedFrom === 'saved_override'
              ? 'rounded border border-violet-500/50 bg-violet-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-violet-200'
              : 'rounded border border-slate-600/80 bg-slate-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400'
          }
          title={loadedTitle}
        >
          {iaRuntimeLoadedFrom === 'saved_override' ? 'Override' : 'Globali'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={catalogBusy}
            onClick={async () => {
              setCatalogBusy(true);
              setCatalogMsg(null);
              try {
                await refreshIaCatalog();
                setCatalogReloadNonce((n) => n + 1);
                setCatalogMsg('Catalogo aggiornato.');
              } catch (e) {
                setCatalogMsg(String(e instanceof Error ? e.message : e));
              } finally {
                setCatalogBusy(false);
              }
            }}
            className="shrink-0 rounded-md border border-slate-500/80 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            title="Sincronizza voci, lingue e modelli (server)"
          >
            {catalogBusy ? '…' : 'Aggiorna catalogo'}
          </button>
          <button
            type="button"
            onClick={() => saveIaRuntimeOverrideToTask()}
            className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-500"
          >
            Salva override
          </button>
        </div>
      </div>
      {catalogMsg ? <p className="text-[10px] text-slate-400">{catalogMsg}</p> : null}
      <IAAgentSetup
        mode="override"
        defaultConfig={baseline}
        value={iaRuntimeConfig}
        onChange={setIaRuntimeConfig}
        catalogReloadNonce={catalogReloadNonce}
      />
    </div>
  );
}
