/**
 * Modello menu inserimenti Recalculation: variabili di flusso (nomi), Param / Prev come gruppi (non liste piatta).
 */

export type AdvancementMonacoInsertOpts = {
  editorVariant: 'singleParam' | 'unifiedBackend';
  wireKey: string;
  snippetParamFieldKeys?: readonly string[];
  snippetFlowVariables?: ReadonlyArray<{ id: string; label: string }>;
};

/** Riga «variabile di flusso»: mostra solo il nome; inserisce commento guida (DSL usa param/prev nel Play). */
export type AdvancementFlowInsertRow = {
  /** Etichetta mostrata (business), es. come in flow. */
  displayLabel: string;
  /** Testo inserito nell’editor. */
  insertText: string;
  /** Tooltip: di solito il GUID variabile. */
  title: string;
};

export type AdvancementInsertMenuModel = {
  mode: 'unified' | 'single';
  flowRows: AdvancementFlowInsertRow[];
  /** Chiavi canoniche SEND (unificato) o [wireKey] in single. */
  paramKeys: string[];
};

const MAX_FLOW_COMMENT_ITEMS = 60;

function buildFlowRows(
  flow: ReadonlyArray<{ id: string; label: string }> | undefined
): AdvancementFlowInsertRow[] {
  if (!flow?.length) return [];
  return flow
    .slice(0, MAX_FLOW_COMMENT_ITEMS)
    .map((v) => {
      const id = String(v.id || '').trim();
      if (!id) return null;
      const labelRaw = String(v.label || id).replace(/\*\//g, '');
      const displayLabel = labelRaw.trim().slice(0, 80) || id;
      return {
        displayLabel,
        insertText: `/* variabile flusso: ${displayLabel} (${id}) */ `,
        title: `id: ${id}`,
      } satisfies AdvancementFlowInsertRow;
    })
    .filter((r): r is AdvancementFlowInsertRow => r !== null);
}

/**
 * Dati per il menu gerarchico: flusso in cima, chiavi param per sottomenu Param (e stesse per Prev).
 */
export function buildAdvancementInsertMenuModel(opts: AdvancementMonacoInsertOpts): AdvancementInsertMenuModel {
  const flowRows = buildFlowRows(opts.snippetFlowVariables);
  const unified = opts.editorVariant === 'unifiedBackend';

  if (unified) {
    const paramKeys = [
      ...new Set(
        (opts.snippetParamFieldKeys ?? [])
          .map((k) => String(k).trim())
          .filter(Boolean)
      ),
    ].sort();
    return { mode: 'unified', flowRows, paramKeys };
  }

  const wk = String(opts.wireKey || '').trim();
  return {
    mode: 'single',
    flowRows,
    paramKeys: wk ? [wk] : [],
  };
}
