/**
 * Dropdown «Deploy» dello stepper del wizard di costruzione AI Agent.
 *
 * Visibile appena gli use case sono pronti/compilabili (gating fatto dal parent: vedi
 * `canCreateConversationalPrompt`). Le conversazioni NON sono prerequisito di Upload.
 *
 * Layout (sezioni separate da divider, sotto un titolo «UPLOAD TO PLATFORM»):
 *   ─── UPLOAD TO PLATFORM ────────────
 *   ☐ Avvio immediato         ← runtime toggle (persistito sul Task)
 *   ☐ Logga Use Case          ← prompt-shaping toggle (persistito sul Task)
 *   ─────────────────────────────────────
 *   ▸ STILE  (opzionale; pill solo se l'utente ne ha checkati nel gate)
 *       [Cortese (2)] [Ironico (1)]
 *   ─────────────────────────────────────
 *   ▸ PLATFORM  (header non cliccabile)
 *       • Anthropic     Manca la voce  [Fix]
 *       • ElevenLabs    Simon
 *       • Gemini        Manca la voce  [Fix]
 *       • OpenAI        Manca la voce  [Fix]
 *   ─────────────────────────────────────
 *   ▸ Copy system prompt
 *
 * **Selezione voce per platform**: la `voicesByPlatform` ricevuta dal parent è già il
 * risultato del resolver (`resolveVoicesByPlatform`), che applica priorità
 * `globale → override del task` (vedi `globalVoiceByPlatform.ts`). Questo componente
 * non conosce la regola: si limita a renderizzare cosa gli viene passato.
 *
 * **Fix**: se la voce è `null`, il bottone Fix è ATTIVO. L'Upload richiede solo che la
 * voce sia configurata; lo stile è opzionale (se selezionato viene propagato).
 *
 * **Copy system prompt**: apre il dialog «Crea prompt conversazionale» esistente per
 * portare il system prompt negli appunti. Sempre disponibile (gating leggero su
 * `copySystemPromptDisabled` dal parent).
 *
 * Il componente è puramente presentazionale: niente fetch, niente `localStorage` diretto.
 */

import React from 'react';
import { ChevronDown, FileText, PlayCircle, Rocket, ScrollText, Wrench } from 'lucide-react';
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
   * Stili attivi nel gate conversazionale (output di `listCheckedStyleIds`). Sono
   * solo informativi/opzionali: l'Upload non li richiede. Se vuoto, la sezione Stile
   * non viene mostrata e l'Upload resta comunque abilitato per ogni Platform con voce.
   */
  availableStyleIds: readonly string[];
  /** Counter conversazioni per stile (per badge nel picker), può essere vuoto. */
  countByStyleId?: Readonly<Record<string, number>>;
  /** Stile target di Upload (single per ora). `null` = nessuno scelto, opzionale. */
  deployStyleId: string | null;
  onDeployStyleIdChange: (next: string | null) => void;
  /**
   * Toggle "Logga Use Case" (vedi `Task.agentLogUseCase`). Quando true, il compilatore di
   * prompt aggiunge il campo `log: "USECASE: \"<NOME>\""` nel JSON di ogni use case e
   * antepone in testa al blocco use cases l'istruzione testuale per il caso "non
   * riconosciuto" (l'agente runtime classifica e marca la risposta con
   * `USECASE: "NUOVO_<TITOLO>"`). Persistito sul Task.
   */
  logUseCaseEnabled: boolean;
  onToggleLogUseCase: (next: boolean) => void;
  /**
   * Toggle "Avvio immediato" (vedi `Task.agentImmediateStart`). Quando true, l'orchestrator
   * runtime inietta un primo turno utente sintetico così l'agente apre il dialogo senza
   * attendere il primo messaggio dell'utente. Spostato qui dal tab "Prompt Finale": è una
   * proprietà di deploy/runtime, naturale vicino agli altri toggle di pubblicazione.
   */
  immediateStartEnabled: boolean;
  onToggleImmediateStart: (next: boolean) => void;
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
  logUseCaseEnabled,
  onToggleLogUseCase,
  immediateStartEnabled,
  onToggleImmediateStart,
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
          className="absolute right-0 z-50 mt-1 w-96 overflow-hidden rounded-md border border-slate-700 bg-slate-950 shadow-xl"
        >
          {/* Title bar non cliccabile, semantica analoga al titolo «UPLOAD TO PLATFORM» nella spec. */}
          <div className="bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            Upload to Platform
          </div>

          {/*
            ── Toggle 1: «Avvio immediato» ─────────────────────────────────────────────

            Spostato qui dal tab "Prompt Finale" (single-pane wizard step 1): è una
            proprietà di runtime/deploy. Persistita su `Task.agentImmediateStart`.

            ── Toggle 2: «Logga Use Case» ─────────────────────────────────────────────

            Decisione che CAMBIA il system prompt e il JSON inviati con l'Upload, quindi
            va valutata PRIMA di scegliere stile/voci.

            Pattern UI condiviso: <label> intera cliccabile (input + testo): il click
            ovunque sulla riga toggla la checkbox. Niente `onClick` su `onChange` per
            evitare doppio fire. Manteniamo il dropdown aperto (no setOpen(false)) così
            l'utente continua a configurare stile/upload subito dopo.
          */}
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
              aria-checked={logUseCaseEnabled}
              title={'Quando attivo, ogni risposta dell\'agente include in coda «USECASE: "<NOME>"» (MAIUSCOLO). Per input non classificabili, l\'agente assegna un nome nuovo e logga «USECASE: "NUOVO_<TITOLO>"».'}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={logUseCaseEnabled}
                onChange={(e) => onToggleLogUseCase(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-amber-500"
              />
              <ScrollText size={12} aria-hidden className="shrink-0 text-amber-300" />
              <span className="flex-1">Logga Use Case</span>
            </label>
          </div>

          {/* ── Sezione STILE: opzionale, mostrata solo se l'utente ha checkato stili ── */}
          {availableStyleIds.length > 0 ? (
            <div className="border-t border-slate-700 bg-slate-950 px-3 py-2">
              <div
                className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                role="presentation"
              >
                Stile (opzionale)
              </div>
              <div className="mt-1.5 pl-3">
                <ConversationStyleSelector
                  value={deployStyleId}
                  onChange={onDeployStyleIdChange}
                  availableStyleIds={availableStyleIds}
                  countByStyleId={countByStyleId}
                />
              </div>
            </div>
          ) : null}

          {/* ── Sezione PLATFORM: header non cliccabile + voci indentate ───────────── */}
          <div className="border-t border-slate-700 bg-slate-950 px-3 py-2">
            <div
              className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
              role="presentation"
            >
              Platform
            </div>
            <ul className="mt-1 pl-3">
              {DROPDOWN_PLATFORMS.map((platform) => {
                const voice = voicesByPlatform[platform] ?? null;
                const label = AGENT_PLATFORM_DISPLAY_LABEL[platform];
                /**
                 * Voce presente → Upload diretto (lo stile è opzionale e, se settato,
                 * viene comunque propagato dal compilatore a monte).
                 * Voce assente   → Fix: apre il pannello voci della platform.
                 * La riga è SEMPRE cliccabile.
                 */
                const uploadEnabled = voice !== null;
                return (
                  <li key={platform}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        if (uploadEnabled && voice) {
                          onUploadToPlatform(platform, voice);
                        } else {
                          onFixVoice(platform);
                        }
                      }}
                      title={
                        voice
                          ? `Pubblica l'agente su ${label} usando la voce «${describeVoice(voice)}»${
                              deployStyleId ? ' nello stile selezionato' : ''
                            }`
                          : `Voce non configurata per ${label}: clicca per aprire il pannello e sceglierla`
                      }
                      className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-xs text-slate-100 hover:bg-slate-800"
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
          </div>

          {/* ── Sezione finale: copy system prompt ─────────────────────────────────── */}
          <div className="border-t border-slate-700 bg-slate-950">
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <FileText size={12} aria-hidden className="text-violet-300" />
              Copy system prompt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
