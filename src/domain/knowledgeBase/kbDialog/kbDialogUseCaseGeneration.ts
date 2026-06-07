/**
 * Generazione deterministica use case da tabella KB + selectorSpec.
 */

import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { newAgentUseCaseTurnId } from '@types/aiAgentUseCases';
import type { KbDocumentSelectorSpec, SelectorColumnSpec } from '../kbSelectorSpec';
import {
  humanizeSelectorAskLabel,
  listAskableSelectorColumns,
} from '../kbSelectorSpec';
import type { KbTabularGrid } from '../parseKbTabularText';
import {
  DEFAULT_KB_DIALOG_COMPLETE_TEMPLATE,
  DEFAULT_KB_DIALOG_CORRECTION_TEMPLATE,
  KB_DIALOG_CATEGORY_ACQUISITION,
  KB_DIALOG_CATEGORY_COMPLETE,
  KB_DIALOG_CATEGORY_CORRECTION,
  KB_DIALOG_CATEGORY_INFORM,
  KB_DIALOG_CATEGORIES,
  KB_DIALOG_EXPLICIT_LIST_MAX,
} from './kbDialogConstants';
import { distinctColumnValuesForKey, filterRowsByBinding } from './kbDialogGrid';
import {
  getNaturalLabel,
  inferValueLabelsFromGrid,
  mergeValueLabels,
} from './kbDialogValueLabels';
import { isEmptySelectorValue, resolveRequiresAcceptance } from './kbDialogSelectorSemantics';
import type {
  GenerateKbDialogUseCasesResult,
  KbDialogAcquisitionRow,
  KbDialogInformRow,
  KbDialogUseCaseMeta,
} from './kbDialogTypes';
import { compileKbDialogRuntimeIndex } from './kbDialogRuntimeIndex';
import { runKbDialogGapAnalysis } from './kbDialogGapAnalysis';

function newUseCaseId(prefix: string): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}_${Date.now().toString(36)}`;
}

function buildScenarioText(text: string): AIAgentUseCase['scenario'] {
  const t = text.trim();
  return t ? { llm: t, descrittivo: t } : undefined;
}

function makeUseCase(params: {
  id: string;
  label: string;
  categoryId: string;
  say: string;
  scenario: string;
  sortOrder: number;
  meta: KbDialogUseCaseMeta;
}): AIAgentUseCase {
  const say = params.say.trim();
  return {
    id: params.id,
    label: params.label,
    parent_id: null,
    sort_order: params.sortOrder,
    category_id: params.categoryId,
    refinement_prompt: '',
    scenario: buildScenarioText(params.scenario),
    payoff: params.scenario.trim(),
    dialogue: [
      {
        turn_id: newAgentUseCaseTurnId(),
        role: 'assistant',
        content: say,
        editable: true,
      },
    ],
    notes: { behavior: params.scenario.trim(), tone: '' },
    bubble_notes: {},
    included_in_conversations: true,
    kb_dialog_meta: params.meta,
  };
}

function bindingPrefixKey(binding: Record<string, string>): string {
  const keys = Object.keys(binding).sort();
  return keys.map((k) => `${k}=${binding[k]}`).join('|');
}

/** Frase acquisition con regole cardinalità (≤3 elenco esplicito). */
export function buildAcquisitionSay(params: {
  col: SelectorColumnSpec;
  allowedValues: readonly string[];
  bindingWhen: Readonly<Record<string, string>>;
  valueLabels: import('../kbSelectorSpec').SelectorValueLabels;
}): string {
  const { col, allowedValues, bindingWhen, valueLabels } = params;
  const labels = allowedValues.map((v) => getNaturalLabel(col.columnId, v, valueLabels));
  const specKey = bindingWhen.specialita ?? bindingWhen.specialty;
  const specNat = specKey ? getNaturalLabel('specialita', specKey, valueLabels) : '';

  if (allowedValues.length <= KB_DIALOG_EXPLICIT_LIST_MAX && labels.length >= 2) {
    if (col.columnId.includes('tipo') && col.columnId.includes('visita') && specNat) {
      const a = labels[0] ?? '';
      const b = labels[1] ?? '';
      if (allowedValues.length === 2) {
        return `Vuole una ${a} ${specNat} o una ${b}?`;
      }
    }
    if (labels.length === 2) {
      return `Desidera ${labels[0]} o ${labels[1]}?`;
    }
    return `Desidera ${labels.slice(0, -1).join(', ')} o ${labels[labels.length - 1]}?`;
  }

  const askLabel = col.promptTemplate.trim() || humanizeSelectorAskLabel(col.headerLabel);
  const capped = askLabel.charAt(0).toUpperCase() + askLabel.slice(1);
  if (allowedValues.length > KB_DIALOG_EXPLICIT_LIST_MAX) {
    return `${capped}?`;
  }
  if (labels.length === 1) {
    return `${capped}: ${labels[0]}?`;
  }
  return `${capped}?`;
}

/** Template disclosure / de-disclosure / transition per UC inform. */
export function buildInformSays(params: {
  col: SelectorColumnSpec;
  informedValue: string;
  bindingWhen: Readonly<Record<string, string>>;
  valueLabels: import('../kbSelectorSpec').SelectorValueLabels;
}): { say: string; deDisclosureSay: string; transitionSay: string } {
  const { col, informedValue, bindingWhen, valueLabels } = params;
  const colNat = getNaturalLabel(col.columnId, informedValue, valueLabels);
  const context = Object.entries(bindingWhen)
    .map(([k, v]) => getNaturalLabel(k, v, valueLabels))
    .filter(Boolean)
    .join(' ');
  const say = context.trim()
    ? `Per ${context} è previsto ${colNat}.`
    : `È previsto ${colNat}.`;
  const deDisclosureSay = `{prev_${col.columnId}_nat} non è più previsto.`;
  const transitionSay = `Invece di {prev_${col.columnId}_nat} è previsto {${col.columnId}_nat}.`;
  return { say, deDisclosureSay, transitionSay };
}

function matchedRowForPrefix(
  grid: KbTabularGrid,
  prefix: Readonly<Record<string, string>>,
  col: SelectorColumnSpec,
  value: string
): readonly string[] | null {
  const binding = { ...prefix, [col.columnId]: value };
  const rows = filterRowsByBinding(grid, binding);
  return rows[0] ?? null;
}

function collectBindingPrefixes(
  grid: KbTabularGrid,
  askable: readonly SelectorColumnSpec[],
  upToColumnId: string
): Record<string, string>[] {
  const targetIdx = askable.findIndex((c) => c.columnId === upToColumnId);
  if (targetIdx <= 0) return [{}];

  const priorCols = askable.slice(0, targetIdx);
  const prefixes = new Map<string, Record<string, string>>();

  for (const row of grid.rows) {
    const prefix: Record<string, string> = {};
    let ok = true;
    for (const col of priorCols) {
      const idx = grid.headers.findIndex(
        (h) => h.trim().toLowerCase() === col.headerLabel.trim().toLowerCase()
      );
      if (idx < 0) {
        ok = false;
        break;
      }
      const cell = String(row[idx] ?? '').trim();
      if (!cell || cell === '-') {
        ok = false;
        break;
      }
      prefix[col.columnId] = cell;
    }
    if (!ok || Object.keys(prefix).length !== priorCols.length) continue;
    prefixes.set(bindingPrefixKey(prefix), prefix);
  }

  return prefixes.size > 0 ? [...prefixes.values()] : [{}];
}

function buildCorrectionSayTemplate(
  triggerCol: SelectorColumnSpec,
  incompatibleCol: SelectorColumnSpec
): string {
  return DEFAULT_KB_DIALOG_CORRECTION_TEMPLATE.replace('{trigger_nat}', `{${triggerCol.columnId}_nat}`)
    .replace('{incompatible_label}', incompatibleCol.promptTemplate || incompatibleCol.headerLabel)
    .replace('{incompatible_value_nat}', `{${incompatibleCol.columnId}_nat}`)
    .replace('{alternativa_messaggio}', '{alternativa_messaggio}');
}

export type GenerateKbDialogUseCasesParams = {
  grid: KbTabularGrid;
  selectorSpec: KbDocumentSelectorSpec;
  kbDocumentId?: string;
};

/** Genera catalogo UC + indice runtime da KB approvata. */
export function generateKbDialogUseCases(
  params: GenerateKbDialogUseCasesParams
): GenerateKbDialogUseCasesResult {
  const { grid, selectorSpec, kbDocumentId } = params;
  const askable = listAskableSelectorColumns(selectorSpec);
  const inferred = inferValueLabelsFromGrid(grid);
  const valueLabels = mergeValueLabels(inferred, selectorSpec.valueLabels ?? {});
  const completeTemplate =
    selectorSpec.completeTemplate?.trim() || DEFAULT_KB_DIALOG_COMPLETE_TEMPLATE;

  const useCases: AIAgentUseCase[] = [];
  let sortOrder = 0;

  const acquisitionRowsBySelector = new Map<string, KbDialogAcquisitionRow[]>();
  const informRowsBySelector = new Map<string, KbDialogInformRow[]>();

  for (const col of askable) {
    const prefixes = collectBindingPrefixes(grid, askable, col.columnId);
    const rowMap = new Map<string, KbDialogAcquisitionRow>();

    for (const prefix of prefixes.length > 0 ? prefixes : [{}]) {
      const allowed = distinctColumnValuesForKey(grid, prefix, col.columnId);
      if (allowed.length <= 1) continue;

      const say = buildAcquisitionSay({
        col,
        allowedValues: allowed,
        bindingWhen: prefix,
        valueLabels,
      });
      const key = `${bindingPrefixKey(prefix)}::${allowed.join(',')}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, { bindingWhen: { ...prefix }, say, allowedValues: allowed });
      }
    }

    const rows = [...rowMap.values()];
    if (rows.length === 0) continue;

    acquisitionRowsBySelector.set(col.columnId, rows);
    const ucId = newUseCaseId(`uc_ask_${col.columnId}`);
    const label = `Chiedi ${col.promptTemplate || col.headerLabel}`;
    useCases.push(
      makeUseCase({
        id: ucId,
        label,
        categoryId: KB_DIALOG_CATEGORY_ACQUISITION,
        say: rows[0]?.say ?? '',
        scenario: `Acquisizione dato mancante: ${col.headerLabel} (${col.columnId}).`,
        sortOrder: sortOrder++,
        meta: {
          kind: 'acquisition',
          selectorColumnId: col.columnId,
          allowedValueCount: rows[0]?.allowedValues.length,
        },
      })
    );
  }

  for (const col of askable) {
    if (!col.informOnAutofill) continue;

    const prefixes = collectBindingPrefixes(grid, askable, col.columnId);
    const rowMap = new Map<string, KbDialogInformRow>();

    for (const prefix of prefixes.length > 0 ? prefixes : [{}]) {
      const allowed = distinctColumnValuesForKey(grid, prefix, col.columnId);
      if (allowed.length !== 1) continue;
      const value = allowed[0]!;
      if (isEmptySelectorValue(col.columnId, value)) continue;

      const templates = buildInformSays({
        col,
        informedValue: value,
        bindingWhen: prefix,
        valueLabels,
      });
      const matched = matchedRowForPrefix(grid, prefix, col, value);
      const requiresAcceptance = resolveRequiresAcceptance({
        col,
        matchedRow: matched,
        headers: grid.headers,
      });

      const key = `${bindingPrefixKey(prefix)}::${value}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          bindingWhen: { ...prefix },
          say: templates.say,
          deDisclosureSay: templates.deDisclosureSay,
          transitionSay: templates.transitionSay,
          informedValue: value,
          ...(requiresAcceptance ? { requiresAcceptance: true } : {}),
        });
      }
    }

    const rows = [...rowMap.values()];
    if (rows.length === 0) continue;

    informRowsBySelector.set(col.columnId, rows);
    const first = rows[0]!;
    const ucId = newUseCaseId(`uc_inform_${col.columnId}`);
    useCases.push(
      makeUseCase({
        id: ucId,
        label: `Informa ${col.promptTemplate || col.headerLabel}`,
        categoryId: KB_DIALOG_CATEGORY_INFORM,
        say: first.say,
        scenario: `Disclosure implicita: ${col.headerLabel} (${col.columnId}) determinato dal binding.`,
        sortOrder: sortOrder++,
        meta: {
          kind: 'inform',
          selectorColumnId: col.columnId,
          informedValue: first.informedValue,
          informTransition: 'disclosure',
          deDisclosureSay: first.deDisclosureSay,
          transitionSay: first.transitionSay,
          ...(first.requiresAcceptance ? { requiresAcceptance: true } : {}),
        },
      })
    );
  }

  for (let i = 0; i < askable.length; i += 1) {
    const trigger = askable[i]!;
    for (let j = i + 1; j < askable.length; j += 1) {
      const downstream = askable[j]!;
      const ucId = newUseCaseId(`uc_corr_${trigger.columnId}_${downstream.columnId}`);
      const template = buildCorrectionSayTemplate(trigger, downstream);
      useCases.push(
        makeUseCase({
          id: ucId,
          label: `Correzione ${trigger.headerLabel} → ${downstream.headerLabel}`,
          categoryId: KB_DIALOG_CATEGORY_CORRECTION,
          say: template,
          scenario: `Correzione: modifica ${trigger.columnId} invalida ${downstream.columnId} se incompatibile.`,
          sortOrder: sortOrder++,
          meta: {
            kind: 'correction',
            triggerColumnId: trigger.columnId,
            invalidatedColumnIds: [downstream.columnId],
          },
        })
      );
    }
  }

  const completeId = newUseCaseId('uc_complete');
  useCases.push(
    makeUseCase({
      id: completeId,
      label: 'Conferma prenotazione (template parametrico)',
      categoryId: KB_DIALOG_CATEGORY_COMPLETE,
      say: completeTemplate,
      scenario: 'Conferma binding completo con template parametrico multi-slot.',
      sortOrder: sortOrder++,
      meta: { kind: 'complete' },
    })
  );

  const categories: AIAgentUseCaseCategory[] = [...KB_DIALOG_CATEGORIES];

  const runtimeIndex = compileKbDialogRuntimeIndex({
    useCases,
    valueLabels,
    completeTemplate,
    kbDocumentId,
    acquisitionRowsBySelector,
    informRowsBySelector,
  });

  const gapIssues = runKbDialogGapAnalysis({
    grid,
    selectorSpec: { ...selectorSpec, valueLabels, completeTemplate },
    runtimeIndex,
    askable,
  });

  return {
    useCases,
    categories,
    runtimeIndex,
    valueLabels,
    completeTemplate,
    gapIssues,
  };
}

export function serializeKbDialogRuntimeIndex(index: import('./kbDialogTypes').KbDialogRuntimeIndex): string {
  return JSON.stringify(index);
}

export function parseKbDialogRuntimeIndex(raw: string | undefined | null): import('./kbDialogTypes').KbDialogRuntimeIndex | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as import('./kbDialogTypes').KbDialogRuntimeIndex;
    if (parsed?.schemaVersion !== 1 || !parsed.complete) return null;
    if (!parsed.inform) parsed.inform = {};
    return parsed;
  } catch {
    return null;
  }
}
