/**
 * Dropdown «Deploy» del wizard AI Agent — percorso deterministico KB (ElevenLabs + omnia_dialog_step).
 *
 * Il menu non mostra diagnostica nel dropdown: al click espande sync ConvAI inline.
 */

import React from 'react';
import { ChevronDown, Loader2, PlayCircle, Rocket, ScrollText, Upload, Wrench } from 'lucide-react';
import type { ConvaiAgentSyncParams, ConvaiAgentSyncResult } from '@domain/convai/convaiAgentSyncTypes';
import { ConvaiAgentSyncPanel } from '../ConvaiAgentSyncPanel';
import type { IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import {
  AGENT_PLATFORM_DISPLAY_LABEL,
  SUPPORTED_AGENT_PLATFORMS,
  describeVoiceForDeployMenu,
  type GlobalVoiceByPlatformMap,
} from '@utils/iaAgentRuntime/globalVoiceByPlatform';

/** Piattaforme nel combobox (ordine UX). */
const DEPLOY_PLATFORMS: readonly IAAgentPlatform[] = SUPPORTED_AGENT_PLATFORMS.filter(
  (p) => p !== 'custom'
);

/** Sync ConvAI attualmente disponibile solo su ElevenLabs. */
const CONVAI_DEPLOY_PLATFORM: IAAgentPlatform = 'elevenlabs';

export interface DeployHandlers {
  onFixVoice: (platform: IAAgentPlatform) => void;
  /** Flush editor state prima di aprire sync (salvataggio task). */
  onDeployAction: () => void;
  convaiSyncParams?: ConvaiAgentSyncParams | null;
  onConvaiSynced?: (result: ConvaiAgentSyncResult) => void;
  compilePhrasesBusy?: boolean;
}

export interface AIAgentDeployMenuProps extends DeployHandlers {
  voicesByPlatform: GlobalVoiceByPlatformMap;
  selectedPlatform?: IAAgentPlatform;
  onSelectedPlatformChange?: (platform: IAAgentPlatform) => void;
  immediateStartEnabled: boolean;
  onToggleImmediateStart: (next: boolean) => void;
  logBackendCallsEnabled: boolean;
  onToggleLogBackendCalls: (next: boolean) => void;
}

export function AIAgentDeployMenu({
  voicesByPlatform,
  selectedPlatform: selectedPlatformProp,
  onSelectedPlatformChange,
  onFixVoice,
  onDeployAction,
  convaiSyncParams = null,
  onConvaiSynced,
  compilePhrasesBusy = false,
  immediateStartEnabled,
  onToggleImmediateStart,
  logBackendCallsEnabled,
  onToggleLogBackendCalls,
}: AIAgentDeployMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [inlineDeployOpen, setInlineDeployOpen] = React.useState(false);
  const [selectedPlatformInternal, setSelectedPlatformInternal] =
    React.useState<IAAgentPlatform>(CONVAI_DEPLOY_PLATFORM);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const selectedPlatform = selectedPlatformProp ?? selectedPlatformInternal;
  const setSelectedPlatform = onSelectedPlatformChange ?? setSelectedPlatformInternal;

  React.useEffect(() => {
    if (!open) setInlineDeployOpen(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e: MouseEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inlineDeployOpen) {
          setInlineDeployOpen(false);
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, inlineDeployOpen]);

  const voice = voicesByPlatform[selectedPlatform] ?? null;
  const voiceLabel = voice ? describeVoiceForDeployMenu(voice) : null;
  const platformLabel = AGENT_PLATFORM_DISPLAY_LABEL[selectedPlatform];
  const convaiPlatformSelected = selectedPlatform === CONVAI_DEPLOY_PLATFORM;
  const canOpenDeploy = convaiPlatformSelected && !compilePhrasesBusy;

  const panelWidthClass = inlineDeployOpen
    ? 'w-[min(32rem,calc(100vw-1.5rem))] max-h-[min(85vh,44rem)] overflow-y-auto'
    : 'w-80 overflow-hidden';

  const handleDeployClick = React.useCallback(() => {
    if (!canOpenDeploy) return;
    onDeployAction();
    setInlineDeployOpen((v) => !v);
  }, [canOpenDeploy, onDeployAction]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Deploy: pubblica l'agente sulla piattaforma selezionata"
        className={[
          'inline-flex items-center gap-1.5 rounded-md border border-amber-500/70 bg-amber-700/85 px-2.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
          compilePhrasesBusy ? 'cursor-wait opacity-90' : '',
        ].join(' ')}
        aria-busy={compilePhrasesBusy}
      >
        {compilePhrasesBusy ? (
          <Loader2 size={13} aria-hidden className="animate-spin" />
        ) : (
          <Rocket size={13} aria-hidden />
        )}
        <span>{compilePhrasesBusy ? 'Compilazione…' : 'Deploy'}</span>
        {!compilePhrasesBusy ? (
          <ChevronDown size={12} aria-hidden className="opacity-80" />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Azioni di deploy"
          className={`absolute right-0 z-50 mt-1 rounded-md border border-slate-700 bg-slate-950 shadow-xl ${panelWidthClass}`}
        >
          <div className="bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            Deploy
          </div>

          <div className="border-t border-slate-700 bg-slate-950">
            <label
              role="menuitemcheckbox"
              aria-checked={immediateStartEnabled}
              title="Quando attivo, l'orchestrator runtime inietta un primo turno utente sintetico: l'agente parte a parlare subito senza aspettare l'utente."
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={immediateStartEnabled}
                onChange={(e) => onToggleImmediateStart(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-amber-500"
              />
              <PlayCircle size={12} aria-hidden className="shrink-0 text-amber-300" />
              <span className="flex-1">Avvio immediato</span>
            </label>
            <label
              role="menuitemcheckbox"
              aria-checked={logBackendCallsEnabled}
              title="Quando attivo, in debugger/chat compaiono riepiloghi delle invocazioni webhook/tool."
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={logBackendCallsEnabled}
                onChange={(e) => onToggleLogBackendCalls(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-amber-500"
              />
              <ScrollText size={12} aria-hidden className="shrink-0 text-orange-300" />
              <span className="flex-1">Mostra chiamate backend</span>
            </label>
          </div>

          <div className="border-t border-slate-700 bg-slate-950 px-3 py-2">
            <div
              className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
              role="presentation"
            >
              Platform
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value as IAAgentPlatform)}
                className="min-w-[8.5rem] flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                aria-label="Piattaforma di deploy"
              >
                {DEPLOY_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {AGENT_PLATFORM_DISPLAY_LABEL[platform]}
                  </option>
                ))}
              </select>
              {voiceLabel ? (
                <span className="truncate text-xs text-slate-300">{voiceLabel}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onFixVoice(selectedPlatform);
                  }}
                  className="inline-flex items-center gap-0.5 rounded border border-amber-500/55 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 hover:bg-amber-900/50"
                >
                  <Wrench size={9} aria-hidden />
                  Fix voce
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-slate-700 bg-slate-950">
            <button
              type="button"
              role="menuitem"
              disabled={!canOpenDeploy}
              aria-expanded={inlineDeployOpen}
              onClick={handleDeployClick}
              title={
                compilePhrasesBusy
                  ? 'Attendi la fine della compilazione in corso'
                  : convaiPlatformSelected
                    ? `Deploy su ${platformLabel}: report nel debugger Omnia + sync agente`
                    : `Deploy automatico disponibile solo su ${AGENT_PLATFORM_DISPLAY_LABEL[CONVAI_DEPLOY_PLATFORM]}`
              }
              className={[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45',
                inlineDeployOpen ? 'bg-slate-900/80' : '',
                compilePhrasesBusy ? 'cursor-wait' : '',
              ].join(' ')}
              aria-busy={compilePhrasesBusy}
            >
              {compilePhrasesBusy ? (
                <Loader2 size={12} aria-hidden className="animate-spin text-violet-300" />
              ) : (
                <Upload size={12} aria-hidden className="text-violet-300" />
              )}
              {compilePhrasesBusy ? 'Compilazione…' : `Deploy su ${platformLabel}`}
            </button>
            {inlineDeployOpen ? (
              <div className="border-t border-violet-800/40 bg-slate-950">
                <ConvaiAgentSyncPanel
                  syncParams={convaiSyncParams}
                  active={inlineDeployOpen}
                  compact
                  onCancel={() => setInlineDeployOpen(false)}
                  onSynced={onConvaiSynced}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
