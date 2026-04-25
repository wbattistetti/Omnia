/**
 * Parametri modello: riga piattaforma sopra; sotto modello LLM + numerici; avanzati in accordion.
 */

import React from 'react';
import type { ReactNode } from 'react';
import type { FieldVisibilityMap, IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { FieldHint } from './FieldHint';
import { LlmModelPicker } from './LlmModelPicker';
import { LlmProviderCatalogPanel } from './LlmProviderCatalogPanel';
import type { ModelCostRow } from './modelCostsCatalog';

const REASONING_LEVELS: IAAgentConfig['reasoning'][] = ['none', 'low', 'medium', 'high'];

/** Width in ch for reasoning select = longest option label + padding. */
const REASONING_SELECT_CH =
  Math.max(...REASONING_LEVELS.map((r) => String(r).length), 4) + 3;

export interface ModelSectionProps {
  config: IAAgentConfig;
  visibility: FieldVisibilityMap;
  showOverrideBadge?: boolean;
  onChange: (next: IAAgentConfig) => void;
  catalogReloadNonce?: number;
  /** Pulsanti piattaforma sulla riga sopra modello/parametri. */
  platformSlot?: ReactNode;
  /** Subito sotto la prima riga parametri (es. Voce/Lingua ElevenLabs). */
  afterParamRow?: ReactNode;
  /** Optional: provision ConvAI agent via ApiServer when Agent ID is empty (ElevenLabs only). */
  onProvisionConvaiAgent?: () => Promise<void>;
  /** Costi UI-only per arricchire la combobox LLM. */
  llmCostRows?: readonly ModelCostRow[];
  /**
   * Quando false, Agent ID e pulsante «Crea agente» non sono qui (es. Developer tools in {@link IAAgentSetup}).
   */
  showElevenLabsConvaiIdentity?: boolean;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

/** Number field with character-based width from current string value. */
function AutosizeNumberInput(props: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  padCh?: number;
}) {
  const { value, onChange, min = 1, max, step, padCh = 1 } = props;
  const str = String(value);
  const ch = Math.min(Math.max(str.length + padCh, 3), 14);
  return (
    <input
      type="number"
      size={ch}
      min={min}
      max={max}
      step={step}
      className="box-border h-8 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none tabular-nums text-slate-100"
      value={value}
      onChange={(e) => {
        const n = Number.parseFloat(e.target.value);
        if (Number.isNaN(n)) return;
        let v = n;
        if (min !== undefined && v < min) v = min;
        if (max !== undefined && v > max) v = max;
        onChange(v);
      }}
    />
  );
}

/** Input largo appena più della caption sopra e del valore (riga principale). */
function CaptionBoundedNumberInput(props: {
  caption: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { caption, value, onChange, min = 1, max, step } = props;
  const str = String(value);
  const ch = Math.min(Math.max(Math.max(caption.length, str.length) + 3, 5), 16);
  return (
    <input
      type="number"
      style={{ width: `${ch}ch`, maxWidth: '16ch' }}
      min={min}
      max={max}
      step={step}
      className="box-border h-8 max-w-[16ch] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none tabular-nums text-slate-100"
      value={value}
      onChange={(e) => {
        const n = Number.parseFloat(e.target.value);
        if (Number.isNaN(n)) return;
        let v = n;
        if (min !== undefined && v < min) v = min;
        if (max !== undefined && v > max) v = max;
        onChange(v);
      }}
    />
  );
}

function TopPInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const str = String(value);
  const ch = Math.min(Math.max(str.length + 2, 4), 10);
  return (
    <input
      type="number"
      step={0.01}
      size={ch}
      className="box-border h-8 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none tabular-nums text-slate-100"
      value={value}
      onChange={(e) => {
        const v = Number.parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
    />
  );
}

function AutosizeModelInput(props: {
  value: string;
  onChange: (v: string) => void;
  minCh?: number;
  maxCh?: number;
}) {
  const { value, onChange, minCh = 10, maxCh = 48 } = props;
  const ch = Math.min(Math.max(value.length, minCh), maxCh);
  return (
    <input
      size={ch}
      className="box-border h-8 max-w-[180px] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none text-slate-100"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  );
}

const TT = {
  modelloLlm:
    'Modello linguistico usato per le risposte. Influenza qualità, costo e latenza. Cambialo quando devi bilanciare precisione, costo o contesto lungo.',
  modelloLlmElevenLabs:
    'Modelli LLM del motore ElevenLabs (lista da GET /v1/convai/llm/list dopo sync sul server). Se la lingua agente non è inglese, la combo mostra solo gli id definiti in config/llmMapping.json.',
  creativity:
    'Temperatura: bassa = risposte più deterministiche e allineate al prompt; alta = più creatività e variabilità. Abbassa per fatti/controlli; alza solo se serve esplorazione o tono informale.',
  tokenMax:
    'Limite massimo di token generati per risposta. Evita tagli prematuri alzandolo per risposte lunghe; abbassalo per costi/latenza.',
  reflection:
    'Quante riflessioni interne può fare l’agente prima di rispondere (ConvAI/ElevenLabs). Più budget = ragionamenti più articolati e latenza maggiore.',
  budgetExplain:
    'Budget di riflessione ConvAI (ElevenLabs): quanti passaggi di ragionamento interno l’agente può fare prima di sintetizzare la risposta vocale. Più alto = più “pensieri” interni e più latenza/costo; 0 = risposta più diretta. Non applicabile agli LLM testuali puri (OpenAI/Gemini ecc.).',
  creativityLlm:
    'Temperatura del sottosistema LLM ConvAI (diverso da eventuali altri controlli). Regola varietà delle risposte vocali/agente.',
  tokenMaxLlm: 'Limite token del modello LLM integrato nell’agente vocale ElevenLabs.',
  reasoning:
    'Reasoning Anthropic: profondità del ragionamento interno prima della risposta. Più alto = migliore su compiti difficili, costo e tempo maggiori.',
  topP:
    'Nucleus sampling: quota di massa di probabilità considerata. Con temperature regola diversità vs coerenza.',
  topK:
    'Gemini: limita il campionamento ai K token più probabili. Utile per ridurre ripetizioni o contenuti fuori tema.',
  freqPen:
    'Penalità su token già usati: riduce ripetizioni letterali. Utile per testo più vario.',
  presPen:
    'Penalità su nuovi topic: incentiva restare sul soggetto corrente.',
  seed:
    'Seme opzionale per riprodurre risultati simili tra esecuzioni (se supportato).',
  stop:
    'Sequenze che interrompono la generazione (API). Solo per integrazioni/sviluppo.',
  stopSeq: 'Equivalente Anthropic alle sequenze di stop.',
  safety: 'Filtri sicurezza Gemini (struttura API). Modifica solo se necessario.',
  wf:
    'Pipeline ConvAI/workflow sul backend ElevenLabs. Modifica solo se integri flussi personalizzati.',
  conv:
    'Impostazioni conversazione ConvAI serializzate (API). Cambia per scenari avanzati o debug integrazione.',
} as const;

export function ModelSection({
  config,
  visibility,
  showOverrideBadge: _showOverrideBadge,
  onChange,
  catalogReloadNonce = 0,
  platformSlot,
  afterParamRow,
  onProvisionConvaiAgent,
  showElevenLabsConvaiIdentity = true,
  llmCostRows = [],
}: ModelSectionProps) {
  const [provisionBusy, setProvisionBusy] = React.useState(false);
  const [provisionError, setProvisionError] = React.useState<string | null>(null);
  const adv = config.advanced ?? {};

  const wfStr = React.useMemo(
    () => (adv.workflow !== undefined ? JSON.stringify(adv.workflow, null, 2) : '{}'),
    [adv.workflow]
  );

  const convStr = React.useMemo(
    () =>
      adv.conversation_settings !== undefined
        ? JSON.stringify(adv.conversation_settings, null, 2)
        : '{}',
    [adv.conversation_settings]
  );

  const patchAdv = (key: string, val: unknown) => {
    onChange({
      ...config,
      advanced: { ...adv, [key]: val },
    });
  };

  const patchLlm = (patch: Record<string, unknown>) => {
    const prev = adv.llm && typeof adv.llm === 'object' && !Array.isArray(adv.llm) ? adv.llm : {};
    onChange({
      ...config,
      advanced: {
        ...adv,
        llm: { ...(prev as Record<string, unknown>), ...patch },
      },
    });
  };

  const llm =
    adv.llm && typeof adv.llm === 'object' && !Array.isArray(adv.llm)
      ? (adv.llm as Record<string, unknown>)
      : {};

  const topPVisible =
    visibility.top_p &&
    (config.platform === 'openai' ||
      config.platform === 'anthropic' ||
      config.platform === 'google');

  const topPEl =
    config.platform === 'openai' ? (
      <TopPInput value={num(adv.top_p, 1)} onChange={(v) => patchAdv('top_p', v)} />
    ) : config.platform === 'anthropic' ? (
      <TopPInput value={num(adv.top_p, 0.95)} onChange={(v) => patchAdv('top_p', v)} />
    ) : config.platform === 'google' ? (
      <TopPInput value={num(adv.topP, 0.95)} onChange={(v) => patchAdv('topP', v)} />
    ) : null;

  const topPLabel = config.platform === 'google' ? 'topP' : 'top_p';

  const elLlmPrimary = config.platform === 'elevenlabs' && visibility.llm_model;
  const showStdTempMax = visibility.temperature && visibility.maxTokens && !elLlmPrimary;

  const showImpostazioniAvanzate =
    (visibility.reasoning && config.platform === 'anthropic') ||
    topPVisible ||
    (visibility.top_k && config.platform === 'google') ||
    visibility.frequency_penalty ||
    visibility.presence_penalty ||
    visibility.seed ||
    visibility.stop ||
    visibility.stop_sequences ||
    visibility.safety_settings ||
    (config.platform === 'elevenlabs' && visibility.workflow);

  return (
    <div className="flex flex-col gap-0.5">
      {platformSlot ? (
        <div className="flex flex-row flex-wrap gap-1">{platformSlot}</div>
      ) : null}

      {config.platform === 'elevenlabs' && showElevenLabsConvaiIdentity ? (
        <FieldHint
          label="ElevenLabs Agent ID"
          tooltip="ID dell’agente ConvAI ElevenLabs (dashboard ElevenLabs / ConvAI); richiesto per il runtime hosted startAgent/readPrompt."
          className="w-full max-w-[min(100%,22rem)] shrink-0"
        >
          <div data-ia-runtime-focus="agentId">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="es. agent_…"
              className="box-border h-8 w-full min-w-[12rem] max-w-[22rem] rounded border border-slate-600 bg-slate-950 px-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500"
              value={config.convaiAgentId ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                onChange({
                  ...config,
                  convaiAgentId: v.length > 0 ? v : undefined,
                });
              }}
            />
          </div>
        </FieldHint>
      ) : null}

      {config.platform === 'elevenlabs' &&
      showElevenLabsConvaiIdentity &&
      onProvisionConvaiAgent &&
      !(config.convaiAgentId ?? '').trim() ? (
        <div className="flex max-w-[min(100%,22rem)] flex-col gap-0.5 shrink-0" data-ia-runtime-focus="agentId">
          <button
            type="button"
            disabled={provisionBusy}
            onClick={async () => {
              setProvisionError(null);
              setProvisionBusy(true);
              try {
                await onProvisionConvaiAgent();
              } catch (e) {
                setProvisionError(e instanceof Error ? e.message : String(e));
              } finally {
                setProvisionBusy(false);
              }
            }}
            className="h-8 rounded border border-violet-600/80 bg-violet-950/60 px-2 text-[11px] font-medium text-violet-100 hover:bg-violet-900/50 disabled:opacity-50"
          >
            {provisionBusy ? 'Creazione agente…' : 'Crea agente ConvAI (ElevenLabs API)'}
          </button>
          {provisionError ? (
            <p className="text-[10px] leading-tight text-red-400">{provisionError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-row flex-wrap items-end gap-x-3 gap-y-2">
        {config.platform === 'openai' ||
        config.platform === 'anthropic' ||
        config.platform === 'google' ? (
          <div className="w-fit max-w-[min(100%,22rem)] shrink-0" data-ia-runtime-focus="model">
            <LlmModelPicker
              reloadNonce={catalogReloadNonce}
              catalogProvider={
                config.platform === 'anthropic'
                  ? 'anthropic'
                  : config.platform === 'google'
                    ? 'google'
                    : 'openai'
              }
              value={config.model}
              onChange={(model) => onChange({ ...config, model })}
              label="LLM"
              labelTooltip={TT.modelloLlm}
              costRows={llmCostRows}
            />
          </div>
        ) : config.platform === 'custom' ? (
          <FieldHint label="LLM" tooltip={TT.modelloLlm} className="w-fit max-w-[min(100%,22rem)] shrink-0">
            <div data-ia-runtime-focus="model">
            <AutosizeModelInput
              value={config.model}
              onChange={(model) => onChange({ ...config, model })}
            />
            </div>
          </FieldHint>
        ) : config.platform === 'elevenlabs' && visibility.llm_model ? (
          <div data-ia-runtime-focus="llm">
            <LlmProviderCatalogPanel
              reloadNonce={catalogReloadNonce}
              catalogPlatform={config.platform}
              agentLanguage={config.voice?.language}
              value={String(llm.model ?? '')}
              onChange={(model) => patchLlm({ model })}
              label="LLM"
              labelTooltip={TT.modelloLlmElevenLabs}
              costRows={llmCostRows}
            />
          </div>
        ) : null}

        {showStdTempMax ? (
          <FieldHint label="Creatività" tooltip={TT.creativity} className="w-fit shrink-0">
            <CaptionBoundedNumberInput
              caption="Creatività"
              value={Number(config.temperature.toFixed(2))}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => onChange({ ...config, temperature: v })}
            />
          </FieldHint>
        ) : null}
        {config.platform === 'elevenlabs' && visibility.llm_model ? (
          <FieldHint label="Creatività" tooltip={TT.creativityLlm} className="w-fit shrink-0">
            <CaptionBoundedNumberInput
              caption="Creatività"
              value={num(llm.temperature, 0.5)}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => patchLlm({ temperature: v })}
            />
          </FieldHint>
        ) : null}

        {showStdTempMax ? (
          <FieldHint label="MAX TOKEN" tooltip={TT.tokenMax} className="w-fit shrink-0">
            <div data-ia-runtime-focus="maxTokens">
            <CaptionBoundedNumberInput
              caption="MAX TOKEN"
              value={config.maxTokens}
              min={1}
              onChange={(maxTokens) =>
                onChange({
                  ...config,
                  maxTokens: Math.floor(maxTokens),
                })
              }
            />
            </div>
          </FieldHint>
        ) : null}
        {config.platform === 'elevenlabs' && visibility.llm_model ? (
          <FieldHint label="MAX TOKEN" tooltip={TT.tokenMaxLlm} className="w-fit shrink-0">
            <CaptionBoundedNumberInput
              caption="MAX TOKEN"
              value={num(llm.max_tokens, 4096)}
              min={1}
              onChange={(v) => patchLlm({ max_tokens: Math.max(1, Math.floor(v)) })}
            />
          </FieldHint>
        ) : null}

        {config.platform === 'elevenlabs' && visibility.llm_model && visibility.reflection_budget ? (
          <FieldHint label="Budget" tooltip={TT.budgetExplain} className="w-fit shrink-0">
            <CaptionBoundedNumberInput
              caption="Budget"
              value={num(llm.reflection_budget, 3)}
              min={0}
              onChange={(v) => patchLlm({ reflection_budget: Math.floor(v) })}
            />
          </FieldHint>
        ) : (
          <div
            className="flex w-fit shrink-0 flex-col gap-0"
            title={TT.budgetExplain}
          >
            <span className="w-fit cursor-help border-b border-dotted border-slate-600 text-[11px] font-semibold leading-snug text-slate-500">
              Budget
            </span>
            <span
              className="h-8 font-mono text-xs leading-8 text-slate-600"
              style={{ width: `${'Budget'.length + 3}ch` }}
            >
              —
            </span>
          </div>
        )}
      </div>

      {afterParamRow ? (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-slate-800/80 pt-1">
          {afterParamRow}
        </div>
      ) : null}

      {showImpostazioniAvanzate ? (
        <details className="rounded border border-slate-700/90 bg-slate-950/50">
          <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
            Impostazioni avanzate
          </summary>
          <div className="flex flex-col gap-2 border-t border-slate-800 px-1.5 py-1">
            <div className="flex flex-row flex-wrap items-end gap-x-1.5 gap-y-0.5">
              {visibility.reasoning && config.platform === 'anthropic' ? (
                <FieldHint label="Ragionamento" tooltip={TT.reasoning} className="shrink-0">
                  <select
                    style={{ width: `${REASONING_SELECT_CH}ch` }}
                    className="box-border h-8 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none text-slate-100"
                    value={config.reasoning}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        reasoning: e.target.value as IAAgentConfig['reasoning'],
                      })
                    }
                  >
                    {REASONING_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FieldHint>
              ) : null}
              {topPVisible && topPEl ? (
                <FieldHint label={topPLabel} tooltip={TT.topP} className="shrink-0">
                  {topPEl}
                </FieldHint>
              ) : null}
              {visibility.top_k && config.platform === 'google' ? (
                <FieldHint label="topK" tooltip={TT.topK} className="shrink-0">
                  <AutosizeNumberInput
                    value={num(adv.topK, 40)}
                    min={1}
                    onChange={(v) => patchAdv('topK', Math.floor(v))}
                  />
                </FieldHint>
              ) : null}
            {visibility.frequency_penalty ? (
              <FieldHint label="freq_pen" tooltip={TT.freqPen} className="shrink-0">
                <AutosizeNumberInput
                  value={num(adv.frequency_penalty, 0)}
                  min={-2}
                  step={0.1}
                  onChange={(v) => patchAdv('frequency_penalty', v)}
                />
              </FieldHint>
            ) : null}
            {visibility.presence_penalty ? (
              <FieldHint label="pres_pen" tooltip={TT.presPen} className="shrink-0">
                <AutosizeNumberInput
                  value={num(adv.presence_penalty, 0)}
                  min={-2}
                  step={0.1}
                  onChange={(v) => patchAdv('presence_penalty', v)}
                />
              </FieldHint>
            ) : null}
            {visibility.seed ? (
              <FieldHint label="seed" tooltip={TT.seed} className="shrink-0">
                <input
                  type="text"
                  size={Math.min(Math.max(String(adv.seed ?? '').length || 1, 4), 14)}
                  placeholder="∅"
                  className="box-border h-8 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-xs leading-none text-slate-100"
                  value={adv.seed === null || adv.seed === undefined ? '' : String(adv.seed)}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    if (!t) {
                      patchAdv('seed', null);
                      return;
                    }
                    const n = Number.parseInt(t, 10);
                    if (!Number.isNaN(n)) patchAdv('seed', n);
                  }}
                />
              </FieldHint>
            ) : null}
            </div>
            {visibility.stop ? (
              <div className="basis-full">
                <FieldHint label="stop (JSON)" tooltip={TT.stop}>
                  <textarea
                    rows={2}
                    className="max-w-[min(100%,280px)] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
                    value={
                      Array.isArray(adv.stop)
                        ? JSON.stringify(adv.stop)
                        : typeof adv.stop === 'string'
                          ? adv.stop
                          : '[]'
                    }
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      try {
                        const parsed = JSON.parse(t) as unknown;
                        if (Array.isArray(parsed)) patchAdv('stop', parsed);
                      } catch {
                        patchAdv('stop', t);
                      }
                    }}
                  />
                </FieldHint>
              </div>
            ) : null}
            {visibility.stop_sequences ? (
              <div className="basis-full">
                <FieldHint label="stop_sequences (JSON)" tooltip={TT.stopSeq}>
                  <textarea
                    rows={2}
                    className="max-w-[min(100%,280px)] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] text-slate-100"
                    value={JSON.stringify(Array.isArray(adv.stop_sequences) ? adv.stop_sequences : [])}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value) as unknown;
                        if (Array.isArray(parsed)) patchAdv('stop_sequences', parsed);
                      } catch {
                        /* invalid */
                      }
                    }}
                  />
                </FieldHint>
              </div>
            ) : null}
            {visibility.safety_settings ? (
              <div className="basis-full">
                <FieldHint label="safetySettings (JSON)" tooltip={TT.safety}>
                  <textarea
                    rows={3}
                    className="max-w-[min(100%,280px)] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] text-slate-100"
                    value={JSON.stringify(adv.safetySettings ?? [])}
                    onChange={(e) => {
                      try {
                        patchAdv('safetySettings', JSON.parse(e.target.value) as unknown);
                      } catch {
                        /* invalid */
                      }
                    }}
                  />
                </FieldHint>
              </div>
            ) : null}
            {config.platform === 'elevenlabs' && visibility.workflow ? (
              <>
            <FieldHint label="workflow (JSON)" tooltip={TT.wf}>
              <textarea
                rows={3}
                className="max-w-[min(100%,320px)] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
                value={wfStr}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value) as unknown;
                    onChange({ ...config, advanced: { ...adv, workflow: parsed } });
                  } catch {
                    /* invalid */
                  }
                }}
              />
            </FieldHint>
            {visibility.conversation_settings ? (
              <FieldHint label="conversation_settings (JSON)" tooltip={TT.conv}>
                <textarea
                  rows={3}
                  className="max-w-[min(100%,320px)] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
                  value={convStr}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as unknown;
                      onChange({
                        ...config,
                        advanced: { ...adv, conversation_settings: parsed },
                      });
                    } catch {
                      /* invalid */
                    }
                  }}
                />
              </FieldHint>
            ) : null}
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
