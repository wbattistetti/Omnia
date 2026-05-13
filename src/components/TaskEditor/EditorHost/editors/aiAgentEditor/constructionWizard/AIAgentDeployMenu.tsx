/**
 * Dropdown «Deploy» dello stepper del wizard di costruzione AI Agent.
 *
 * Visibile SOLO quando tutti i 5 step ufficiali sono completati (gating fatto dal parent).
 * Espone due gruppi di azioni:
 *
 * 1. **Upload to Platform**: per ciascuna piattaforma supportata (Anthropic, ElevenLabs,
 *    Gemini, OpenAI, in ordine alfabetico) mostra:
 *      - se la voce DEFAULT GLOBALE per quella piattaforma è impostata → label + nome voce
 *        (es. «Anthropic — Simon»). Click invoca {@link DeployHandlers.onUploadToPlatform};
 *      - se la voce è assente → label + «Manca la voce – Fix». Click invoca
 *        {@link DeployHandlers.onFixVoice} (apre il pannello voce per quella piattaforma).
 *    Le piattaforme per cui non è disponibile provisioning reale sono comunque cliccabili:
 *    sta al chiamante decidere il comportamento (di norma, toast informativo).
 *
 * 2. **Copy system prompt**: apre il dialog «Crea prompt conversazionale» esistente per
 *    permettere di copiare il system prompt completo. Voce sempre attiva.
 *
 * Il componente è puramente presentazionale: non fa fetch, non legge `localStorage` direttamente.
 * Il parent gli passa la mappa `voicesByPlatform` (caricata via {@link loadGlobalVoiceByPlatform})
 * e gli handler di azione. Così è semplice da testare e da wire-uppare.
 */

import React from 'react';
import { ChevronDown, FileText, Rocket, Wrench } from 'lucide-react';
import type { IAAgentPlatform, IAAgentVoiceConfig } from 'types/iaAgentRuntimeSetup';
import {
  AGENT_PLATFORM_DISPLAY_LABEL,
  SUPPORTED_AGENT_PLATFORMS,
  describeVoice,
  type GlobalVoiceByPlatformMap,
} from '@utils/iaAgentRuntime/globalVoiceByPlatform';
import { ConversationStyleSelector } from '../useCaseGeneratorWizard/ConversationStyleSelector';

/** Piattaforme effettivamente esposte nel dropdown (ordine alfabetico per UX). */
const DROPDOWN_PLATFORMS: readonly IAAgentPlatform[] = SUPPORTED_AGENT_PLATFORMS.filter(
  (p) => p !== 'custom'
);

export interface DeployHandlers {
  /**
   * Chiamato quando l'utente clicca «Upload to Platform → <Platform>» con voce CONFIGURATA.
   * Il chiamante è responsabile del provisioning effettivo (es. `createConvaiAgentViaOmniaServer`
   * per ElevenLabs) o del fallback informativo (toast) per le piattaforme non ancora supportate.
   */
  onUploadToPlatform: (platform: IAAgentPlatform, voice: IAAgentVoiceConfig) => void;
  /**
   * Chiamato quando l'utente clicca su un item con voce MANCANTE («Fix»). Tipicamente apre
   * il pannello Settings > IA Runtime con `platform` settata su `platform` e focus al picker voce.
   */
  onFixVoice: (platform: IAAgentPlatform) => void;
  /**
   * Chiamato per «Copy system prompt»: apre il dialog «Crea prompt conversazionale» esistente
   * (l'utente vi clicca «Copia tutto» per portare il prompt negli appunti).
   */
  onCopySystemPrompt: () => void;
  /** True se «Copy system prompt» NON è disponibile (es. use case non ancora compilabili). */
  copySystemPromptDisabled?: boolean;
  /** Tooltip mostrato sull'item disabilitato (motivo del block). */
  copySystemPromptDisabledReason?: string;
}

export interface AIAgentDeployMenuProps extends DeployHandlers {
  /** Mappa platform → voce di default globale (caricata dal parent). Manca = «non configurata». */
  voicesByPlatform: GlobalVoiceByPlatformMap;
  /**
   * **v2 multi-stile**: id degli stili che hanno almeno una conversazione generata
   * (output di `listGeneratedStyleIds`). Solo questi sono pubblicabili. Se vuoto,
   * il picker mostra un placeholder "Genera prima una conversazione" e tutti gli
   * Upload sono disabilitati.
   */
  availableStyleIds: readonly string[];
  /** Counter conversazioni per stile (per badge nel picker). */
  countByStyleId?: Readonly<Record<string, number>>;
  /** Stile target di Upload (single per ora). `null` = nessuno scelto → Upload disabled. */
  deployStyleId: string | null;
  onDeployStyleIdChange: (next: string | null) => void;
}

export function AIAgentDeployMenu({
  voicesByPlatform,
  onUploadToPlatform,
  onFixVoice,
  onCopySystemPrompt,
  copySystemPromptDisabled = false,
  copySystemPromptDisabledReason,
  availableStyleIds,
  countByStyleId,
  deployStyleId,
  onDeployStyleIdChange,
}: AIAgentDeployMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  /**
   * Chiusura del dropdown su click esterno e su tasto Esc. Coerente con i pattern UI già usati
   * altrove nell'editor AI Agent (vedi VoicePicker / ModelTreePicker).
   */
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
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
        title="Deploy: pubblica l'agente su una piattaforma o copia il system prompt"
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/70 bg-amber-700/85 px-2.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
      >
        <Rocket size={13} aria-hidden />
        <span>Deploy</span>
        <ChevronDown size={12} aria-hidden className="opacity-80" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Azioni di deploy"
          className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-md border border-slate-700 bg-slate-950/98 shadow-xl"
        >
          <div className="border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Upload to Platform
          </div>
          {/*
            Picker stile target di Upload (v2 multi-stile). Se non c'è alcuno styleId
            disponibile (nessuna conversazione generata) mostriamo un placeholder e
            disabilitiamo gli Upload. Se l'utente seleziona uno stile, gli item
            platform diventano cliccabili (subordinati alla disponibilità della voce).
          */}
          <div className="border-b border-slate-800 bg-slate-900/40 px-3 py-2">
            {availableStyleIds.length > 0 ? (
              <ConversationStyleSelector
                label="Stile:"
                value={deployStyleId}
                onChange={onDeployStyleIdChange}
                availableStyleIds={availableStyleIds}
                countByStyleId={countByStyleId}
              />
            ) : (
              <p className="text-[11px] italic text-slate-500">
                Genera almeno una conversazione per poter pubblicare.
              </p>
            )}
          </div>
          <ul className="py-1">
            {DROPDOWN_PLATFORMS.map((platform) => {
              const voice = voicesByPlatform[platform] ?? null;
              const label = AGENT_PLATFORM_DISPLAY_LABEL[platform];
              const styleSelected = deployStyleId !== null;
              const uploadEnabled = styleSelected && voice !== null;
              const itemDisabled = !styleSelected;
              return (
                <li key={platform}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={itemDisabled}
                    onClick={() => {
                      if (itemDisabled) return;
                      setOpen(false);
                      if (uploadEnabled && voice) {
                        onUploadToPlatform(platform, voice);
                      } else {
                        onFixVoice(platform);
                      }
                    }}
                    title={
                      !styleSelected
                        ? 'Seleziona prima uno stile sopra'
                        : voice
                        ? `Pubblica l'agente su ${label} usando la voce «${describeVoice(voice)}» nello stile selezionato`
                        : `Voce non configurata per ${label}: clicca per aprire il pannello e sceglierla`
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs text-slate-100 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                  >
                    <span className="font-medium">{label}</span>
                    {voice ? (
                      <span className="truncate text-slate-300" title={describeVoice(voice)}>
                        {describeVoice(voice)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <span className="italic">Manca la voce</span>
                        <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/55 bg-amber-950/40 px-1 py-px text-[10px] font-semibold uppercase tracking-wide">
                          <Wrench size={9} aria-hidden />
                          Fix
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-slate-800" />

          <ul className="py-1">
            <li>
              <button
                type="button"
                role="menuitem"
                disabled={copySystemPromptDisabled}
                onClick={() => {
                  setOpen(false);
                  onCopySystemPrompt();
                }}
                title={
                  copySystemPromptDisabled
                    ? copySystemPromptDisabledReason ||
                      'Disponibile quando tutti gli use case sono compilabili'
                    : 'Apre il dialog «Crea prompt conversazionale» per copiare il system prompt'
                }
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-100 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FileText size={12} aria-hidden className="text-violet-300" />
                Copy system prompt
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
