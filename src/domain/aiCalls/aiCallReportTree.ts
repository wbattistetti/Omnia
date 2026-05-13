/**
 * Domain helper: trasforma un log piatto di {@link AiCallRecord} nell'albero "macro-task"
 * usato dal report ad accordion (vedi `AiCallLogDialog`).
 *
 * Modello mentale (concordato con il prodotto):
 *
 *   - Le chiamate IA del task editor portano `(taskId, taskLabel)` (snapshot al momento della
 *     call) propagati end-to-end FE -> BE -> log. Qui le raggruppiamo per `taskId` per dare
 *     all'utente la vista "tutti i costi della creazione del task X" — coerente con il modello
 *     di lavoro: l'utente percepisce un task come una singola unit\u00e0 di lavoro indipendentemente
 *     da quante chiamate IA ha originato (Create + N use case + N conversation + ...).
 *
 *   - I record senza `taskId` (chiamate globali: traduzioni dalla UI, training-phrases lato
 *     intent editor, ecc.) finiscono in un nodo dedicato `"__GLOBAL__"` che il rendering
 *     etichetta come "Globale (senza task)".
 *
 *   - Il `taskLabel` mostrato nell'header del gruppo \u00e8 lo SNAPSHOT pi\u00f9 recente trovato per
 *     quel `taskId` (i record sono ordinati per `ts` desc all'ingresso). Se in records
 *     successivi la label \u00e8 cambiata (rinomina del task, o task cancellato e ricreato con lo
 *     stesso id) il rendering pu\u00f2 indicarlo confrontando con i record vecchi (vedi `labelHistory`).
 *
 * Aggregati per nodo (single source of truth per l'header):
 *   - `callCount`     : numero totale di chiamate (incluse quelle in errore).
 *   - `errorCount`    : numero di chiamate con `error` non-null.
 *   - `inputTokens`   : somma token input.
 *   - `outputTokens`  : somma token output.
 *   - `totalTokens`   : somma `totalTokens` (pu\u00f2 differire da inputTokens+outputTokens per
 *                       record legacy che riportavano solo il totale).
 *   - `costUsd`       : somma `costUsd` (sempre presente).
 *   - `costEur`       : somma `costEur` se disponibile su TUTTI i record del gruppo, altrimenti
 *                       `null` (per non mentire all'utente con totali parziali EUR).
 *   - `durationMs`    : somma latenze.
 *   - `firstTs` / `lastTs` : range temporale del gruppo (utile per ordinare per data e per
 *                            rendere "oggi/ieri" nei sottotitoli).
 *
 * Ordinamento (sort mode):
 *   - `'date'`        : nodi ordinati per `lastTs` desc (default; il pi\u00f9 recente in alto, come
 *                       chiede l'utente). I record dentro a ciascun nodo seguono la stessa
 *                       regola.
 *   - `'alphabetical'`: nodi per `taskLabel` asc (case-insensitive, locale-aware). Il nodo
 *                       globale (senza task) finisce sempre in coda.
 *
 * NB: questo modulo \u00e8 puro e privo di dipendenze runtime/UI. Tutta la logica di rendering /
 * stato persistito (espansione nodi in `localStorage`, ecc.) vive nel componente del dialog.
 */

import type { AiCallRecord } from '@services/aiCallsApi';

/** Sentinel id per le chiamate senza `taskId`. Mai presente in `AiCallRecord.taskId`. */
export const AI_CALL_REPORT_GLOBAL_NODE_ID = '__GLOBAL__';

/** Modalit\u00e0 di ordinamento esposte dal report ad albero. */
export type AiCallReportSortMode = 'date' | 'alphabetical';

/** Aggregati calcolati per un nodo (gruppo di chiamate). */
export interface AiCallReportNodeAggregates {
  readonly callCount: number;
  readonly errorCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costUsd: number;
  /** `null` se anche solo un record del gruppo non ha `costEur`. Vedi rationale nel modulo. */
  readonly costEur: number | null;
  readonly durationMs: number;
  readonly firstTs: string;
  readonly lastTs: string;
}

/** Nodo "macro-task" del report ad albero. */
export interface AiCallReportNode {
  /** `taskId` originante o {@link AI_CALL_REPORT_GLOBAL_NODE_ID} per il gruppo globale. */
  readonly id: string;
  /**
   * Label snapshot del task (la pi\u00f9 recente trovata nel gruppo). Per il nodo globale: stringa
   * fissa `"Globale (senza task)"` — il rendering pu\u00f2 sovrascriverla per i18n.
   */
  readonly label: string;
  /**
   * Tutte le label distinte trovate per questo `taskId`, in ordine cronologico (oldest first).
   * Se il task \u00e8 stato rinominato, qui il rendering pu\u00f2 indicare la storia (es. tooltip
   * "ex: Vecchio nome").
   */
  readonly labelHistory: readonly string[];
  readonly aggregates: AiCallReportNodeAggregates;
  /** Record del gruppo, ordinati secondo {@link AiCallReportSortMode} (asc/desc come da modulo). */
  readonly records: readonly AiCallRecord[];
}

/** Output della costruzione albero: lista ordinata di nodi macro-task. */
export interface AiCallReportTree {
  readonly nodes: readonly AiCallReportNode[];
  readonly aggregates: AiCallReportNodeAggregates;
  readonly sortMode: AiCallReportSortMode;
}

/** Utility: combina due aggregati in un nuovo aggregato. */
function mergeAggregates(
  a: AiCallReportNodeAggregates,
  b: AiCallReportNodeAggregates
): AiCallReportNodeAggregates {
  const costEur = a.costEur === null || b.costEur === null ? null : a.costEur + b.costEur;
  return {
    callCount: a.callCount + b.callCount,
    errorCount: a.errorCount + b.errorCount,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    costUsd: a.costUsd + b.costUsd,
    costEur,
    durationMs: a.durationMs + b.durationMs,
    firstTs: a.firstTs < b.firstTs ? a.firstTs : b.firstTs,
    lastTs: a.lastTs > b.lastTs ? a.lastTs : b.lastTs,
  };
}

/** Utility: aggregato neutro per accumulazione. */
function emptyAggregates(seedTs: string): AiCallReportNodeAggregates {
  return {
    callCount: 0,
    errorCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    costEur: 0,
    durationMs: 0,
    firstTs: seedTs,
    lastTs: seedTs,
  };
}

/**
 * Trasforma un singolo record in aggregato. Le combinazioni vengono fatte da
 * {@link mergeAggregates}; rispetta la regola "costEur null se manca".
 */
function recordAsAggregates(r: AiCallRecord): AiCallReportNodeAggregates {
  return {
    callCount: 1,
    errorCount: r.error ? 1 : 0,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    costUsd: r.costUsd,
    costEur: r.costEur,
    durationMs: r.durationMs,
    firstTs: r.ts,
    lastTs: r.ts,
  };
}

/**
 * Costruisce l'albero macro-task del report a partire dal log piatto delle chiamate IA.
 *
 * @param records   Lista (in qualunque ordine) di record letti dal backend.
 * @param sortMode  Ordinamento richiesto dei nodi e dei record interni.
 * @param globalLabel Etichetta del nodo "Globale (senza task)" — passabile per i18n; default ITA.
 */
export function buildAiCallReportTree(
  records: readonly AiCallRecord[],
  sortMode: AiCallReportSortMode = 'date',
  globalLabel: string = 'Globale (senza task)'
): AiCallReportTree {
  if (records.length === 0) {
    const empty: AiCallReportNodeAggregates = {
      callCount: 0,
      errorCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      costEur: null,
      durationMs: 0,
      firstTs: '',
      lastTs: '',
    };
    return { nodes: [], aggregates: empty, sortMode };
  }

  /**
   * Ordinamento ascendente per `ts` per costruire `labelHistory` in modo cronologico (oldest
   * first). L'ordine dei record nei nodi viene poi ribaltato pi\u00f9 sotto secondo `sortMode`.
   */
  const recordsAscByTs = [...records].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const groupsById = new Map<
    string,
    {
      labelHistory: string[];
      records: AiCallRecord[];
      aggregates: AiCallReportNodeAggregates;
    }
  >();

  for (const rec of recordsAscByTs) {
    const groupId =
      typeof rec.taskId === 'string' && rec.taskId ? rec.taskId : AI_CALL_REPORT_GLOBAL_NODE_ID;
    const isGlobal = groupId === AI_CALL_REPORT_GLOBAL_NODE_ID;
    const labelForRecord = isGlobal
      ? globalLabel
      : typeof rec.taskLabel === 'string' && rec.taskLabel
        ? rec.taskLabel
        : '(senza nome)';

    const existing = groupsById.get(groupId);
    if (existing) {
      existing.records.push(rec);
      existing.aggregates = mergeAggregates(existing.aggregates, recordAsAggregates(rec));
      const lastLabel = existing.labelHistory[existing.labelHistory.length - 1];
      if (lastLabel !== labelForRecord) {
        existing.labelHistory.push(labelForRecord);
      }
    } else {
      groupsById.set(groupId, {
        labelHistory: [labelForRecord],
        records: [rec],
        aggregates: mergeAggregates(emptyAggregates(rec.ts), recordAsAggregates(rec)),
      });
    }
  }

  /**
   * Costruzione nodi finali: la `label` esposta \u00e8 l'ultima dello snapshot (la pi\u00f9 recente)
   * — coerente con la regola "il nome attuale del task appare nell'header". `labelHistory`
   * resta disponibile per il rendering tooltip "ex: ...".
   */
  let nodes: AiCallReportNode[] = [];
  for (const [id, group] of groupsById.entries()) {
    const recordsSorted = [...group.records].sort((a, b) =>
      a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0
    );
    const label = group.labelHistory[group.labelHistory.length - 1] || globalLabel;
    nodes.push({
      id,
      label,
      labelHistory: group.labelHistory,
      aggregates: group.aggregates,
      records: recordsSorted,
    });
  }

  /**
   * Ordinamento dei nodi:
   *  - `date`         : per `lastTs` desc; in caso di pareggio, alfabetico per stabilit\u00e0.
   *  - `alphabetical` : per `label` asc, locale-aware case-insensitive; il nodo globale in coda
   *                     (sentinel id) per non sporcare la lista alfabetica con un "G" forzato.
   */
  if (sortMode === 'alphabetical') {
    nodes = nodes.sort((a, b) => {
      const aIsGlobal = a.id === AI_CALL_REPORT_GLOBAL_NODE_ID;
      const bIsGlobal = b.id === AI_CALL_REPORT_GLOBAL_NODE_ID;
      if (aIsGlobal && !bIsGlobal) return 1;
      if (bIsGlobal && !aIsGlobal) return -1;
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });
  } else {
    nodes = nodes.sort((a, b) => {
      const cmpTs = a.aggregates.lastTs < b.aggregates.lastTs ? 1 : a.aggregates.lastTs > b.aggregates.lastTs ? -1 : 0;
      if (cmpTs !== 0) return cmpTs;
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });
  }

  /** Aggregato totale (footer del dialog): somma di tutti i nodi. */
  const totalAggregates = nodes.reduce(
    (acc, n) => mergeAggregates(acc, n.aggregates),
    emptyAggregates(nodes[0]?.aggregates.firstTs || '')
  );

  return { nodes, aggregates: totalAggregates, sortMode };
}
