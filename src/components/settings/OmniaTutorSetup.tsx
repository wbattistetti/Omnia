/**
 * Designer-only Omnia Tutor LLM settings (templates, reasoning, prompts). Not for runtime agents.
 *
 * La tendina dei modelli e popolata dinamicamente dal catalogo backend
 * (`/api/ia-catalog/ui/models?provider=...`): nessuna lista hardcoded di modelli.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { OmniaTutorConfig } from 'types/omniaTutorTypes';
import { type AIProvider, useAIProvider } from '@context/AIProviderContext';
import {
  loadOmniaTutorConfig,
  saveOmniaTutorConfig,
} from '@utils/omniaTutor/omniaTutorPersistence';
import {
  useAvailableLlmModels,
  type AvailableLlmProviderSpec,
} from '@hooks/useAvailableLlmModels';
import type { LlmCatalogProviderId } from '@services/iaCatalogApi';
import { ModelTreePicker } from '@components/common/ModelTreePicker';
import { consumeMissingAiModelReason } from '@utils/aiModelGuard';

const REASONING_LEVELS: OmniaTutorConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];

/**
 * Provider esposti nella tendina del Tutor. L'id del catalogo backend (`LlmCatalogProviderId`)
 * deve corrispondere a un `AIProvider` selezionabile dal context globale.
 */
const TUTOR_PROVIDERS: ReadonlyArray<
  AvailableLlmProviderSpec & { contextProvider: AIProvider }
> = [
  { id: 'groq', displayLabel: 'Groq', contextProvider: 'groq' },
  { id: 'openai', displayLabel: 'OpenAI', contextProvider: 'openai' },
];

function contextProviderFor(catalogProvider: LlmCatalogProviderId): AIProvider | null {
  const match = TUTOR_PROVIDERS.find((p) => p.id === catalogProvider);
  return match ? match.contextProvider : null;
}

function safetyToRows(safety: Record<string, unknown>): Array<{ key: string; value: string }> {
  const s = safety ?? {};
  return Object.keys(s).map((k) => ({
    key: k,
    value: typeof s[k] === 'string' ? s[k] : JSON.stringify(s[k]),
  }));
}

function rowsToSafety(rows: Array<{ key: string; value: string }>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    const raw = r.value.trim();
    if (!raw) {
      next[k] = '';
      continue;
    }
    try {
      next[k] = JSON.parse(raw) as unknown;
    } catch {
      next[k] = raw;
    }
  }
  return next;
}

function SafetyEditor({
  safety,
  onChange,
}: {
  safety: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  type Row = { key: string; value: string };
  const [rows, setRows] = React.useState<Row[]>(() => safetyToRows(safety));

  React.useEffect(() => {
    setRows(safetyToRows(safety));
  }, [safety]);

  const commit = (nextRows: Row[]) => {
    setRows(nextRows);
    onChange(rowsToSafety(nextRows));
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    commit(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addRow = () => commit([...rows, { key: '', value: '' }]);

  const removeRow = (idx: number) => commit(rows.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={`${row.key}-${idx}`} className="flex gap-2">
          <input
            placeholder="key"
            className="w-1/3 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            value={row.key}
            onChange={(e) => updateRow(idx, { key: e.target.value })}
          />
          <input
            placeholder="value"
            className="flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
            value={row.value}
            onChange={(e) => updateRow(idx, { value: e.target.value })}
          />
          <button type="button" className="text-xs text-red-400" onClick={() => removeRow(idx)}>
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-100"
        onClick={addRow}
      >
        Add safety key
      </button>
    </div>
  );
}

export function OmniaTutorSetup() {
  const { setProvider, setModel } = useAIProvider();
  const providerSpecs = React.useMemo(
    () => TUTOR_PROVIDERS.map(({ id, displayLabel }) => ({ id, displayLabel })),
    []
  );
  const { items: modelOptions, loading: modelsLoading, errors: modelErrors, reload: reloadModels } =
    useAvailableLlmModels(providerSpecs);

  const [config, setConfig] = React.useState<OmniaTutorConfig>(() => loadOmniaTutorConfig());

  /**
   * Banner shown when the user landed here from an AI CTA that was blocked because no model
   * was selected. The flag is consumed exactly once (read on mount) so navigating away and
   * back will not redisplay it spuriously. The banner stays visible until the user picks a
   * valid model from the catalog.
   */
  const [missingModelBanner, setMissingModelBanner] = React.useState<boolean>(() =>
    consumeMissingAiModelReason()
  );

  React.useEffect(() => {
    const opt = modelOptions.find((o) => o.id === config.model);
    if (opt) {
      const ctxProvider = contextProviderFor(opt.provider);
      if (ctxProvider) setProvider(ctxProvider);
      setModel(config.model);
    } else {
      setModel(config.model);
    }
  }, [config.model, modelOptions, setModel, setProvider]);

  const persist = React.useCallback((next: OmniaTutorConfig) => {
    setConfig(next);
    saveOmniaTutorConfig(next);
  }, []);

  const hasValidSelection = React.useMemo(() => {
    const selected = typeof config.model === 'string' ? config.model.trim() : '';
    if (!selected) return false;
    return modelOptions.some((o) => o.id === selected);
  }, [config.model, modelOptions]);

  React.useEffect(() => {
    if (missingModelBanner && hasValidSelection) {
      setMissingModelBanner(false);
    }
  }, [missingModelBanner, hasValidSelection]);

  const hasModelOptions = modelOptions.length > 0;
  const errorSummary = modelErrors.length
    ? modelErrors.map((e) => `${e.provider}: ${e.message}`).join(' | ')
    : null;

  return (
    <div className="space-y-6 max-w-2xl text-slate-100">
      {missingModelBanner ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-lg border border-red-500/55 bg-red-950/55 px-4 py-3 text-sm text-red-50 shadow-lg"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-semibold text-red-100">Devi scegliere il modello LLM</div>
            <div className="text-xs leading-snug text-red-100/85">
              Hai avviato un’azione IA senza aver selezionato il modello dell’Omnia Tutor.
              Scegli un provider e un modello qui sotto e poi torna al task per riprovare.
            </div>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-slate-400">
        Configurazione dell’LLM interno del designer (template, assistenza, prompt). Non usata per agenti
        runtime o utenti finali.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <label className="space-y-1 sm:col-span-6">
          <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>Modello {hasModelOptions ? `(${modelOptions.length})` : ''}</span>
            <button
              type="button"
              onClick={reloadModels}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              disabled={modelsLoading}
              title="Ricarica la lista live dal catalogo backend"
            >
              {modelsLoading ? 'Caricamento…' : 'Ricarica'}
            </button>
          </span>
          <ModelTreePicker
            value={config.model}
            options={modelOptions}
            providers={providerSpecs.map((p) => ({ id: p.id, label: p.displayLabel }))}
            disabled={modelsLoading && !hasModelOptions}
            placeholder={
              modelsLoading && !hasModelOptions
                ? 'Caricamento modelli disponibili…'
                : 'Scegli un modello'
            }
            onChange={(modelId) => persist({ ...config, model: modelId })}
          />
          {config.model && !modelOptions.some((o) => o.id === config.model) ? (
            <span className="block text-[10px] leading-tight text-amber-300">
              Modello salvato {`"${config.model}"`} non presente nel catalogo live (potrebbe essere
              deprecato o la chiave API non lo espone). Selezionane uno disponibile.
            </span>
          ) : null}
          {errorSummary ? (
            <span className="block text-[10px] leading-tight text-red-300">
              Catalogo modelli non completo — {errorSummary}. Verifica le API key e fai un POST su
              <code className="mx-1 rounded bg-slate-800 px-1 py-0.5">/api/ia-catalog/refresh</code>.
            </span>
          ) : null}
          {!modelsLoading && !hasModelOptions && !errorSummary ? (
            <span className="block text-[10px] leading-tight text-amber-300">
              Catalogo vuoto. Imposta <code>OPENAI_API_KEY</code> e/o <code>GROQ_API_KEY</code> sul backend e
              fai un POST su <code>/api/ia-catalog/sync/models</code>.
            </span>
          ) : null}
        </label>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Reasoning</span>
          <select
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
            value={config.reasoning}
            onChange={(e) =>
              persist({
                ...config,
                reasoning: e.target.value as OmniaTutorConfig['reasoning'],
              })
            }
          >
            {REASONING_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">maxTokens</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
            value={config.maxTokens}
            onChange={(e) =>
              persist({
                ...config,
                maxTokens: Math.max(1, Math.floor(Number.parseFloat(e.target.value) || 1)),
              })
            }
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Temperatura ({config.temperature.toFixed(2)})
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          className="w-full"
          value={config.temperature}
          onChange={(e) => persist({ ...config, temperature: Number.parseFloat(e.target.value) })}
        />
      </label>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Safety</div>
        <SafetyEditor
          safety={config.safety ?? {}}
          onChange={(safety) => persist({ ...config, safety })}
        />
      </div>
    </div>
  );
}
