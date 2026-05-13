/**
 * `ConversationStyleSelector` — componente di sola lettura per selezionare uno stile
 * tra quelli che hanno almeno una conversazione generata.
 *
 * Riusato in:
 *  - **Filtro vista** sopra `ConversationsBubbleView`: il designer sceglie lo stile da
 *    visualizzare; le bubble vengono filtrate per `conversation.styleId`.
 *  - **Picker stile target di Upload** (in `AIAgentDeployMenu`): l'Upload è disabilitato
 *    finché non viene selezionato uno stile.
 *
 * Differenze rispetto a `ConversationStyleEditor`:
 *  - Niente checkbox né editing testuale: pill di sola selezione singola.
 *  - Le pill sono limitate agli stili che hanno conversazioni (vedi
 *    `listGeneratedStyleIds`) — non si può filtrare/uplodare uno stile vuoto.
 *  - Non mostra sentinel tecnici: le conversazioni legacy senza `styleId` vengono già
 *    normalizzate dal domain helper sullo stile default («Cortese»).
 *
 * Stato: completamente controllato dal padre (`value` + `onChange`).
 */

import React from 'react';
import { AI_AGENT_GLOBAL_USE_CASE_STYLES } from '../constants';
import { CONVERSATION_LEGACY_STYLE_ID } from '@domain/useCaseGeneratorWizard/types';

export interface ConversationStyleSelectorProps {
  /** styleId attualmente selezionato. `null` = nessuna selezione. */
  readonly value: string | null;
  readonly onChange: (next: string | null) => void;
  /** Lista degli styleId disponibili (output di `listGeneratedStyleIds`). */
  readonly availableStyleIds: readonly string[];
  /**
   * Conteggio conversazioni per styleId (badge `Cortese (3)`). Output di
   * `countConversationsByStyleId`. Può mancare se non rilevante (es. per Upload solo
   * pill semplice senza counter).
   */
  readonly countByStyleId?: Readonly<Record<string, number>>;
  /**
   * Etichetta accessoria mostrata prima delle pill (es. «Filtra:», «Upload:»).
   * Default: nessuna label esterna.
   */
  readonly label?: string;
  /**
   * Modalità "filter": include una pill «Tutti» (value=null) per resettare il filtro.
   * Default `false` (modalità "picker": una scelta obbligatoria).
   */
  readonly includeAllOption?: boolean;
  /**
   * Quando `true` i pill sono disabilitati (es. durante una generazione in corso).
   */
  readonly disabled?: boolean;
}

const PILL_BASE =
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:opacity-45 disabled:cursor-not-allowed';
const PILL_INACTIVE = 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80';
const PILL_ACTIVE = 'border-sky-400/80 bg-sky-950/55 text-sky-100';

function labelForStyleId(styleId: string): string {
  if (styleId === CONVERSATION_LEGACY_STYLE_ID) return '—';
  const known = AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === styleId);
  if (known) return known.label;
  return styleId; // sconosciuto al registry: mostra l'id letteralmente
}

export function ConversationStyleSelector({
  value,
  onChange,
  availableStyleIds,
  countByStyleId,
  label,
  includeAllOption = false,
  disabled = false,
}: ConversationStyleSelectorProps): React.ReactElement | null {
  if (availableStyleIds.length === 0 && !includeAllOption) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={label ?? 'Selettore stile'}>
      {label ? (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>
      ) : null}
      {includeAllOption ? (
        <button
          type="button"
          role="tab"
          aria-selected={value === null}
          disabled={disabled}
          onClick={() => onChange(null)}
          className={[PILL_BASE, value === null ? PILL_ACTIVE : PILL_INACTIVE].join(' ')}
          title="Mostra tutti gli stili"
        >
          Tutti
        </button>
      ) : null}
      {availableStyleIds.map((styleId) => {
        const isActive = value === styleId;
        const count = countByStyleId?.[styleId];
        return (
          <button
            key={styleId}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(styleId)}
            className={[PILL_BASE, isActive ? PILL_ACTIVE : PILL_INACTIVE].join(' ')}
            title={`Stile «${labelForStyleId(styleId)}»`}
          >
            <span>{labelForStyleId(styleId)}</span>
            {typeof count === 'number' && count > 0 ? (
              <span className="tabular-nums opacity-75">({count})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
