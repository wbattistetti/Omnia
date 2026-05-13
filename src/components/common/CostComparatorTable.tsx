/**
 * `CostComparatorTable` — tabella comparativa dei prezzi LLM (€/M token).
 *
 * Visualizza l'output di {@link buildCostComparatorRows} con barra proporzionale al
 * costo totale (input+output €/M). Componente **stateless e pilotato da props**:
 * niente fetch, niente context. Chi consuma sceglie la sorgente dati (OmniaTutorSetup
 * oggi, ma riusabile da una futura cost dashboard cross-provider).
 *
 * Decisioni UX (designer 2026-05-13):
 *  - Solo EUR (default progetto). USD canonico resta accessibile via tooltip cella.
 *  - Modello "free" → label "free" verde, barra a 0%.
 *  - Cambio EUR n/d → mostriamo "n/d" nelle celle €/M (le barre cadono comunque sul
 *    fallback USD per non perdere il segnale comparativo).
 *  - Tabella scrollabile verticalmente (`max-h-72`) per non sfondare il layout della
 *    pagina settings quando il catalogo è ampio (~150 modelli OpenRouter).
 *  - Sblocco modelli premium: i `unlockedKeys` possono essere **lifted up** (passando
 *    `unlockedKeys` + `onUnlock`) così che lo stesso set sia condiviso con altri
 *    selettori della pagina (es. il `ModelTreePicker`). Senza prop la tabella mantiene
 *    il proprio state interno (modalità uncontrolled per riusi standalone).
 */

import React from 'react';
import { AlertTriangle, Loader2, Lock, RefreshCw } from 'lucide-react';
import {
  buildCostComparatorRows,
  filterPricingByProviders,
  isAboveCostThresholdEur,
  type CostComparatorRow,
  type ProviderId,
} from '@domain/aiCost/costComparator';
import type { LlmPricingEntry } from '@services/aiCallsApi';
import { LockPasswordPromptForm } from './LockPasswordPromptForm';

/**
 * Password di unlock cablata per la prima iterazione (designer 2026-05-13).
 * **Non è un segreto**: il client la conosce e qualunque utente con DevTools può
 * leggerla. Serve solo come "speed bump" per evitare clic accidentali su modelli
 * costosi. Quando si vorrà una vera autorizzazione → spostarla server-side
 * (`POST /api/ai-calls/pricing/unlock` con verifica JWT/sessione).
 *
 * Esportata per consentire alla pagina chiamante di applicare lo stesso gate ad
 * altri selettori (picker, dropdown) senza duplicare il valore.
 */
export const DEFAULT_UNLOCK_PASSWORD = 'omnia';

export interface CostComparatorTableProps {
  /** Catalogo pricing già caricato (solitamente da `useLlmPricingCatalog`). */
  readonly items: ReadonlyArray<LlmPricingEntry>;
  /** Cambio cached (`AiCallLogContext.exchangeRate.usdToEur`). `null` = n/d. */
  readonly usdToEur: number | null;
  /** Filtro opzionale per provider attivi nella pagina chiamante (es. solo openai/groq). */
  readonly allowedProviders?: ReadonlySet<ProviderId>;
  /** Highlight per la riga del modello attualmente selezionato (matching su `provider/model`). */
  readonly selectedKey?: string | null;
  /** ISO timestamp dell'ultima sync — mostrato come hint nel footer. */
  readonly updatedAt?: string | null;
  /** True durante il fetch iniziale — disabilita il bottone refresh e mostra spinner. */
  readonly loading?: boolean;
  /** True durante il POST di re-sync da OpenRouter. */
  readonly refreshing?: boolean;
  /** Errore fail-loud dal backend; null se tutto ok. */
  readonly error?: string | null;
  /** Callback per forzare il re-sync (POST /api/ai-calls/pricing/refresh). */
  readonly onRefresh?: () => void | Promise<void>;
  /**
   * Callback "selezione dalla griglia". Quando definito, ogni riga **selezionabile**
   * (vedi {@link CostComparatorTableProps.selectableKeys}) diventa un control con
   * `role="button"` e on-click chiama questo handler — il designer può scegliere
   * il modello direttamente dalla tabella, senza tornare al picker sopra.
   * Omettere per una tabella read-only.
   */
  readonly onSelect?: (entry: LlmPricingEntry) => void;
  /**
   * Whitelist opzionale dei `key` (= `provider/model`, vedi {@link LlmPricingEntry.rawId})
   * considerati selezionabili. Se omesso, tutte le righe sono cliccabili (purché
   * `onSelect` sia definito). Le righe non in whitelist sono mostrate ma inerti, con
   * tooltip esplicativo — utile per non nascondere modelli noti che però la API key
   * locale non espone (fail-early UX: l'utente vede l'opzione ma capisce subito
   * perché non può usarla).
   */
  readonly selectableKeys?: ReadonlySet<string>;
  /**
   * Soglia (in EUR per 1M token totali, input+output) oltre la quale la riga viene
   * **lockata**: il designer deve cliccare il lucchetto e digitare la `unlockPassword`
   * per renderla cliccabile. Default `null` = nessun lock.
   */
  readonly costLockThresholdEur?: number | null;
  /** Password per sbloccare le righe sopra soglia. Default {@link DEFAULT_UNLOCK_PASSWORD}. */
  readonly unlockPassword?: string;
  /**
   * Set dei `row.key` già sbloccati. Se passato, la tabella diventa **controlled**:
   * la sorgente di verità degli sblocchi è esterna, e il submit di una password
   * corretta invoca `onUnlock(rowKey)` invece di mutare lo state interno.
   *
   * Use case primario: condividere lo sblocco con un altro selettore della stessa
   * pagina (es. `ModelTreePicker` in `OmniaTutorSetup`) — sblocchi una volta, la
   * scelta del modello costoso vale ovunque finché la pagina è montata.
   */
  readonly unlockedKeys?: ReadonlySet<string>;
  /**
   * Callback chiamato quando l'utente sottomette la password corretta su una riga
   * lockata. Il parent deve aggiungere `rowKey` al proprio set di unlock. Solo
   * significativo in combinazione con {@link CostComparatorTableProps.unlockedKeys}.
   */
  readonly onUnlock?: (rowKey: string) => void;
}

/**
 * Etichetta short del provider (badge a sinistra del modello). I provider non
 * sono enumerati in un componente esistente perché qui ci basta una mappatura UI
 * compatta — il valore canonico resta `entry.providerId`.
 */
const PROVIDER_LABEL: Readonly<Record<ProviderId, string>> = {
  openai: 'OpenAI',
  groq: 'Groq',
  anthropic: 'Anthropic',
  google: 'Google',
};

const PROVIDER_BADGE: Readonly<Record<ProviderId, string>> = {
  openai: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/60',
  groq: 'bg-violet-900/40 text-violet-200 border-violet-700/60',
  anthropic: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  google: 'bg-sky-900/40 text-sky-200 border-sky-700/60',
};

/**
 * Formatta un valore €/M con precisione adattiva: 4 decimali sotto 1€ (modelli
 * economici, dove la differenza si gioca sulle frazioni di centesimo),
 * 2 decimali sopra (gpt-4o, claude opus, ecc.). Sempre `tabular-nums` per
 * allineamento a destra.
 */
function formatEurPerMillion(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/d';
  if (value === 0) return '0';
  const fractionDigits = value < 1 ? 4 : 2;
  return `${value.toLocaleString('it-IT', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} €`;
}

function formatUsdPerMillionTooltip(value: number): string {
  if (value === 0) return 'free';
  const fd = value < 1 ? 4 : 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  })} / 1M`;
}

/**
 * Stato semantico di una riga ai fini dell'interazione utente. Mutuamente esclusivi:
 *  - `selectable` = cliccabile, on-click chiama `onSelect`.
 *  - `locked`     = costo > soglia, mostra lucchetto + tooltip; click sul lucchetto
 *                   apre il prompt password (gestito dal parent via `onUnlockClick`).
 *  - `inert`      = visibile ma non cliccabile (es. modello non in whitelist).
 *                   `reason` finisce nel tooltip per spiegare al designer.
 */
type RowInteractionState =
  | { kind: 'selectable' }
  | { kind: 'locked' }
  | { kind: 'inert'; reason: string | null };

function ComparatorRow({
  row,
  highlighted,
  fxAvailable,
  state,
  onSelect,
  onUnlockClick,
}: {
  row: CostComparatorRow;
  highlighted: boolean;
  fxAvailable: boolean;
  state: RowInteractionState;
  /** Invocato su click/Enter solo quando `state.kind === 'selectable'`. */
  onSelect: () => void;
  /** Invocato su click del lucchetto o sulla riga lockata. */
  onUnlockClick: () => void;
}): React.ReactElement {
  const isSelectable = state.kind === 'selectable';
  const isLocked = state.kind === 'locked';
  const inertReason = state.kind === 'inert' ? state.reason : null;
  /**
   * Tastiera: Enter/Space attivano l'azione primaria della riga — `onSelect` se
   * selezionabile, `onUnlockClick` se lockata. Inerti restano no-op.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (isSelectable) {
      e.preventDefault();
      onSelect();
    } else if (isLocked) {
      e.preventDefault();
      onUnlockClick();
    }
  };
  const interactive = isSelectable || isLocked;
  const onClick = isSelectable ? onSelect : isLocked ? onUnlockClick : undefined;
  const title = isLocked
    ? 'Modello premium (>10 €/M): clicca il lucchetto per sbloccarlo con password.'
    : inertReason ?? undefined;
  return (
    <tr
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        isSelectable
          ? `Seleziona ${row.providerId}/${row.modelId}`
          : isLocked
            ? `Sblocca ${row.providerId}/${row.modelId}`
            : undefined
      }
      title={title}
      className={
        'text-slate-200 odd:bg-slate-800/30 transition-colors ' +
        (highlighted ? 'outline outline-1 outline-violet-500 bg-violet-950/25 ' : '') +
        (isSelectable
          ? 'cursor-pointer hover:bg-sky-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 '
          : isLocked
            ? 'cursor-pointer hover:bg-amber-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 '
            : inertReason
              ? 'opacity-60 cursor-not-allowed '
              : '')
      }
    >
      <td className="px-2 py-1 align-middle">
        <div className="inline-flex items-center gap-1.5">
          <span
            className={
              'inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
              PROVIDER_BADGE[row.providerId]
            }
          >
            {PROVIDER_LABEL[row.providerId]}
          </span>
          {isLocked ? (
            <button
              type="button"
              onClick={(e) => {
                /* Stop propagation: il click del bottone non deve scatenare anche `tr.onClick`. */
                e.stopPropagation();
                onUnlockClick();
              }}
              aria-label={`Sblocca ${row.providerId}/${row.modelId}: richiede password`}
              title="Modello premium: clicca per inserire la password e sbloccare"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-amber-300 hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <Lock size={12} aria-hidden />
            </button>
          ) : null}
        </div>
      </td>
      <td
        className="px-2 py-1 font-mono text-[12px] text-slate-100"
        title={`${row.providerId}/${row.modelId}`}
      >
        {row.modelId}
      </td>
      <td
        className="px-2 py-1 text-right tabular-nums"
        title={formatUsdPerMillionTooltip(row.inputUsdPer1M)}
      >
        {row.isFree ? (
          <span className="text-emerald-300">free</span>
        ) : (
          formatEurPerMillion(row.inputEurPer1M)
        )}
      </td>
      <td
        className="px-2 py-1 text-right tabular-nums"
        title={formatUsdPerMillionTooltip(row.outputUsdPer1M)}
      >
        {row.isFree ? (
          <span className="text-emerald-300">free</span>
        ) : (
          formatEurPerMillion(row.outputEurPer1M)
        )}
      </td>
      <td className="px-2 py-1">
        <div
          className="relative h-2 w-full overflow-hidden rounded bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(row.barWidthPercent)}
          aria-label={`Costo relativo: ${Math.round(row.barWidthPercent)}%`}
          title={
            fxAvailable
              ? `Costo totale per 1M token (input + output)`
              : `Cambio EUR n/d — barra calcolata su USD canonico`
          }
        >
          <div
            className={
              'absolute inset-y-0 left-0 ' +
              (row.isFree
                ? 'bg-emerald-600/70'
                : row.barWidthPercent > 66
                  ? 'bg-rose-500/80'
                  : row.barWidthPercent > 33
                    ? 'bg-amber-500/80'
                    : 'bg-sky-500/80')
            }
            style={{ width: `${row.barWidthPercent}%` }}
          />
        </div>
      </td>
    </tr>
  );
}

export function CostComparatorTable({
  items,
  usdToEur,
  allowedProviders,
  selectedKey = null,
  updatedAt = null,
  loading = false,
  refreshing = false,
  error = null,
  onRefresh,
  onSelect,
  selectableKeys,
  costLockThresholdEur = null,
  unlockPassword = DEFAULT_UNLOCK_PASSWORD,
  unlockedKeys,
  onUnlock,
}: CostComparatorTableProps): React.ReactElement {
  const filteredItems = React.useMemo(
    () => (allowedProviders ? filterPricingByProviders(items, allowedProviders) : [...items]),
    [items, allowedProviders]
  );
  const rows = React.useMemo(
    () => buildCostComparatorRows(filteredItems, usdToEur),
    [filteredItems, usdToEur]
  );
  /**
   * Index inverso `key → entry` per restituire al chiamante l'oggetto pricing
   * completo nel callback (più informativo di soli provider/model).
   */
  const itemByKey = React.useMemo(() => {
    const map = new Map<string, LlmPricingEntry>();
    for (const it of filteredItems) {
      map.set(it.rawId || `${it.providerId}/${it.modelId}`, it);
    }
    return map;
  }, [filteredItems]);

  const fxAvailable = usdToEur !== null;
  const isEmpty = !loading && rows.length === 0 && !error;

  /**
   * Modalità controlled vs uncontrolled per gli sblocchi: se il parent passa
   * `unlockedKeys`, è la fonte di verità (così può condividerli con altri
   * selettori della pagina). Altrimenti la tabella tiene il proprio state interno.
   */
  const isUnlockControlled = unlockedKeys !== undefined;
  const [internalUnlocked, setInternalUnlocked] = React.useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const effectiveUnlocked = isUnlockControlled
    ? (unlockedKeys as ReadonlySet<string>)
    : internalUnlocked;
  const [unlockTargetKey, setUnlockTargetKey] = React.useState<string | null>(null);

  const handleUnlockSubmit = React.useCallback(
    (rowKey: string, password: string): boolean => {
      if (password !== unlockPassword) return false;
      if (isUnlockControlled) {
        onUnlock?.(rowKey);
      } else {
        setInternalUnlocked((prev) => {
          const next = new Set(prev);
          next.add(rowKey);
          return next;
        });
      }
      setUnlockTargetKey(null);
      return true;
    },
    [unlockPassword, isUnlockControlled, onUnlock]
  );

  return (
    <section
      aria-labelledby="cost-comparator-heading"
      className="rounded-md border border-slate-700/60 bg-slate-950/40 p-3"
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="cost-comparator-heading"
            className="text-xs font-semibold uppercase tracking-wide text-slate-200"
          >
            Cost comparator
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Prezzi €/M token (input + output) dei modelli disponibili. Sorgente: OpenRouter,
            convertito al cambio ECB.
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading || refreshing}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2 text-[11px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            title="Forza il re-sync da OpenRouter"
          >
            {refreshing || loading ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={12} aria-hidden />
            )}
            Aggiorna
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="flex items-start gap-2 rounded border border-rose-700/60 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>Errore caricando il pricing: {error}</span>
        </div>
      ) : null}

      {!fxAvailable && !error && !loading ? (
        <div className="mb-2 flex items-start gap-2 rounded border border-amber-700/60 bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Cambio EUR non disponibile: i prezzi sono mostrati come «n/d» e le barre usano USD
            come metro. Riprova più tardi.
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-400">
          <Loader2 size={13} className="animate-spin" aria-hidden />
          Caricamento catalogo pricing…
        </div>
      ) : isEmpty ? (
        <div className="py-4 text-center text-[11px] text-slate-400">
          Nessun modello nel catalogo pricing per i provider selezionati. Prova ad aggiornare.
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded border border-slate-800/70">
          <table className="w-full table-auto border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1.5">Provider</th>
                <th className="px-2 py-1.5">Modello</th>
                <th className="px-2 py-1.5 text-right" title="Costo input per 1M token">
                  Input €/M
                </th>
                <th className="px-2 py-1.5 text-right" title="Costo output per 1M token">
                  Output €/M
                </th>
                <th
                  className="px-2 py-1.5"
                  title="Barra comparativa proporzionale al costo totale (input + output) del modello più caro"
                >
                  Comparazione
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const inWhitelist = selectableKeys ? selectableKeys.has(row.key) : true;
                const canSelect = onSelect !== undefined && inWhitelist;
                const locked =
                  canSelect &&
                  costLockThresholdEur !== null &&
                  isAboveCostThresholdEur(row, costLockThresholdEur) &&
                  !effectiveUnlocked.has(row.key);
                /**
                 * Tooltip inerte: differenziamo tra "manca on-select" (read-only) e
                 * "non in whitelist" (modello non esposto dalla nostra API key).
                 * Il primo caso non mostra tooltip — la riga è semplicemente passiva.
                 */
                const inertReason =
                  onSelect !== undefined && !inWhitelist
                    ? `Modello «${row.modelId}» non disponibile nel catalogo locale (la chiave API non lo espone).`
                    : null;
                const state: RowInteractionState = locked
                  ? { kind: 'locked' }
                  : canSelect
                    ? { kind: 'selectable' }
                    : { kind: 'inert', reason: inertReason };
                return (
                  <React.Fragment key={row.key}>
                    <ComparatorRow
                      row={row}
                      highlighted={selectedKey !== null && row.key === selectedKey}
                      fxAvailable={fxAvailable}
                      state={state}
                      onUnlockClick={() => setUnlockTargetKey(row.key)}
                      onSelect={() => {
                        const entry = itemByKey.get(row.key);
                        if (entry && onSelect) onSelect(entry);
                      }}
                    />
                    {unlockTargetKey === row.key ? (
                      <tr className="bg-amber-950/20">
                        <td colSpan={5} className="px-3 py-2">
                          <LockPasswordPromptForm
                            modelId={row.modelId}
                            providerId={row.providerId}
                            onCancel={() => setUnlockTargetKey(null)}
                            onSubmit={(password) => handleUnlockSubmit(row.key, password)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {updatedAt ? (
        <footer className="mt-2 text-right text-[10px] text-slate-500">
          Sincronizzato: {new Date(updatedAt).toLocaleString('it-IT')}
        </footer>
      ) : null}
    </section>
  );
}
