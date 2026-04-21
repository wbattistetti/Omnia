/**
 * Designer-only Omnia Tutor LLM settings (templates, reasoning, prompts). Not for runtime agents.
 */

import React from 'react';
import type { OmniaTutorConfig } from 'types/omniaTutorTypes';
import { AI_PROVIDERS, type AIProvider, useAIProvider } from '@context/AIProviderContext';
import {
  loadOmniaTutorConfig,
  saveOmniaTutorConfig,
} from '@utils/omniaTutor/omniaTutorPersistence';

const REASONING_LEVELS: OmniaTutorConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];

function buildModelOptions(): Array<{ id: string; label: string; provider: AIProvider }> {
  const out: Array<{ id: string; label: string; provider: AIProvider }> = [];
  for (const m of AI_PROVIDERS.groq.models) {
    out.push({ id: m.id, label: `[Groq] ${m.label}`, provider: 'groq' });
  }
  for (const m of AI_PROVIDERS.openai.models) {
    out.push({ id: m.id, label: `[OpenAI] ${m.label}`, provider: 'openai' });
  }
  return out;
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
  const modelOptions = React.useMemo(() => buildModelOptions(), []);

  const [config, setConfig] = React.useState<OmniaTutorConfig>(() => loadOmniaTutorConfig());

  React.useEffect(() => {
    const opt = modelOptions.find((o) => o.id === config.model);
    if (opt) {
      setProvider(opt.provider);
      setModel(config.model);
    } else {
      setModel(config.model);
    }
  }, [config.model, modelOptions, setModel, setProvider]);

  const persist = React.useCallback((next: OmniaTutorConfig) => {
    setConfig(next);
    saveOmniaTutorConfig(next);
  }, []);

  return (
    <div className="space-y-6 max-w-2xl text-slate-100">
      <p className="text-sm text-slate-400">
        Configurazione dell’LLM interno del designer (template, assistenza, prompt). Non usata per agenti
        runtime o utenti finali.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <label className="space-y-1 sm:col-span-6">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modello</span>
          <select
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
            value={config.model}
            onChange={(e) => persist({ ...config, model: e.target.value })}
          >
            {!modelOptions.some((o) => o.id === config.model) ? (
              <option value={config.model}>{config.model}</option>
            ) : null}
            {modelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
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
