/**
 * Pannello unico configurazione LLM designer (Omnia Tutor + portale review): modello,
 * reasoning, token, temperatura, safety, cost comparator.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { OmniaTutorConfig } from 'types/omniaTutorTypes';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import {
  loadOmniaTutorConfig,
  saveOmniaTutorConfig,
} from '@utils/omniaTutor/omniaTutorPersistence';
import { consumeMissingAiModelReason } from '@utils/aiModelGuard';
import { useLlmPricingCatalog } from '@hooks/useLlmPricingCatalog';
import { useAiCallLog } from '@context/AiCallLogContext';
import { CostComparatorTable } from '@components/common/CostComparatorTable';
import {
  DesignerLlmModelPickerUi,
  useDesignerLlmModelSelection,
  DESIGNER_LLM_COST_LOCK_THRESHOLD_EUR,
} from './DesignerLlmModelSelector';
import { DESIGNER_LLM_PROVIDERS } from './designerLlmProviders';
import { type ProviderId } from '@domain/aiCost/costComparator';

const REASONING_LEVELS: OmniaTutorConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];

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

export interface DesignerLlmSetupPanelProps {
  /** Omnia Studio: banner se l’utente arriva da un’azione IA senza modello. */
  showMissingModelBannerFromGuard?: boolean;
  /** Snapshot modello pubblicato da Omnia (portale review). */
  publishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
  className?: string;
}

/** Unica UI — stesso markup ovunque (Studio inline, modale portale/editor). */
export function DesignerLlmSetupPanel({
  showMissingModelBannerFromGuard = false,
  publishedSnapshot = null,
  className = '',
}: DesignerLlmSetupPanelProps): React.ReactElement {
  const [config, setConfig] = React.useState<OmniaTutorConfig>(() => loadOmniaTutorConfig());

  const [missingModelBanner, setMissingModelBanner] = React.useState<boolean>(
    () => showMissingModelBannerFromGuard && consumeMissingAiModelReason()
  );

  const persist = React.useCallback((next: OmniaTutorConfig) => {
    setConfig(next);
    saveOmniaTutorConfig(next);
  }, []);

  const modelSelection = useDesignerLlmModelSelection({
    model: config.model,
    onModelChange: (modelId) => persist({ ...config, model: modelId }),
    publishedSnapshot,
  });

  React.useEffect(() => {
    if (missingModelBanner && modelSelection.hasValidSelection) {
      setMissingModelBanner(false);
    }
  }, [missingModelBanner, modelSelection.hasValidSelection]);

  const pricingCatalog = useLlmPricingCatalog();
  const { exchangeRate } = useAiCallLog();
  const tutorAllowedProviders = React.useMemo<ReadonlySet<ProviderId>>(
    () =>
      new Set<ProviderId>(
        DESIGNER_LLM_PROVIDERS.map((p) => p.id).filter((id): id is ProviderId =>
          (['openai', 'groq', 'anthropic', 'google'] as const).includes(id as ProviderId)
        )
      ),
    []
  );

  const selectedPricingKey = React.useMemo(() => {
    const id = String(config.model || '').trim();
    if (!id) return null;
    const match = pricingCatalog.items.find(
      (it) => it.modelId === id || it.rawId.endsWith(`/${id}`)
    );
    return match ? match.rawId : null;
  }, [config.model, pricingCatalog.items]);

  const selectableTutorKeys = React.useMemo<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    for (const opt of modelSelection.modelOptions) {
      set.add(`${opt.provider}/${opt.id}`);
    }
    return set;
  }, [modelSelection.modelOptions]);

  return (
    <div className={`space-y-6 max-w-2xl text-slate-100 ${className}`.trim()}>
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
        <DesignerLlmModelPickerUi selection={modelSelection} />
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

      <div className="pt-2">
        <CostComparatorTable
          items={pricingCatalog.items}
          usdToEur={exchangeRate?.usdToEur ?? null}
          allowedProviders={tutorAllowedProviders}
          selectedKey={selectedPricingKey}
          updatedAt={pricingCatalog.meta.updatedAt}
          loading={pricingCatalog.loading}
          refreshing={pricingCatalog.refreshing}
          error={pricingCatalog.error}
          onRefresh={pricingCatalog.refresh}
          onSelect={modelSelection.handleSelectFromGrid}
          selectableKeys={selectableTutorKeys}
          costLockThresholdEur={DESIGNER_LLM_COST_LOCK_THRESHOLD_EUR}
          unlockedKeys={modelSelection.unlockedKeys}
          onUnlock={modelSelection.handleUnlockFromTable}
        />
      </div>
    </div>
  );
}
