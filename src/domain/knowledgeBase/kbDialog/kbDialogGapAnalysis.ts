/**
 * Gap analysis design-time per catalogo UC dialogo KB.
 */

import type { KbDocumentSelectorSpec, SelectorColumnSpec } from '../kbSelectorSpec';
import type { KbTabularGrid } from '../parseKbTabularText';
import { listAskableSelectorColumns } from '../kbSelectorSpec';
import {
  interpolateCompleteTemplate,
  looksUnnaturalCompleteSay,
} from './kbDialogCompleteTemplate';
import { distinctColumnValuesForKey, filterRowsByBinding } from './kbDialogGrid';
import { isEmptySelectorValue } from './kbDialogSelectorSemantics';
import { getNaturalLabel } from './kbDialogValueLabels';
import type { KbDialogGapIssue, KbDialogRuntimeIndex } from './kbDialogTypes';

export type RunKbDialogGapAnalysisParams = {
  grid: KbTabularGrid;
  selectorSpec: KbDocumentSelectorSpec;
  runtimeIndex: KbDialogRuntimeIndex;
  askable?: readonly SelectorColumnSpec[];
};

function uniqueCompleteBindings(
  grid: KbTabularGrid,
  askable: readonly SelectorColumnSpec[]
): Record<string, string>[] {
  const seen = new Set<string>();
  const out: Record<string, string>[] = [];

  for (const row of grid.rows) {
    const binding: Record<string, string> = {};
    for (const col of askable) {
      const idx = grid.headers.findIndex(
        (h) => h.trim().toLowerCase() === col.headerLabel.trim().toLowerCase()
      );
      if (idx < 0) continue;
      const v = String(row[idx] ?? '').trim();
      if (v && v !== '-') binding[col.columnId] = v;
    }
    const key = JSON.stringify(binding);
    if (!seen.has(key) && Object.keys(binding).length === askable.length) {
      seen.add(key);
      out.push(binding);
    }
  }
  return out;
}

/** Verifica copertura catalogo UC KB (bloccante per deploy). */
export function runKbDialogGapAnalysis(params: RunKbDialogGapAnalysisParams): KbDialogGapIssue[] {
  const issues: KbDialogGapIssue[] = [];
  const askable = params.askable ?? listAskableSelectorColumns(params.selectorSpec);
  const { grid, runtimeIndex } = params;
  const valueLabels = runtimeIndex.valueLabels;

  for (const col of askable) {
    const entry = runtimeIndex.acquisition[col.columnId];
    let needsAcquisition = false;
    let needsInform = false;

    for (const row of grid.rows) {
      const prefix: Record<string, string> = {};
      for (const c of askable) {
        if (c.columnId === col.columnId) break;
        const idx = grid.headers.findIndex(
          (h) => h.trim().toLowerCase() === c.headerLabel.trim().toLowerCase()
        );
        if (idx < 0) continue;
        const v = String(row[idx] ?? '').trim();
        if (v && v !== '-') prefix[c.columnId] = v;
      }
      const allowed = distinctColumnValuesForKey(grid, prefix, col.columnId);
      if (allowed.length >= 2) {
        needsAcquisition = true;
      }
      if (
        col.informOnAutofill &&
        allowed.length === 1 &&
        allowed[0] &&
        !isEmptySelectorValue(col.columnId, allowed[0])
      ) {
        needsInform = true;
      }
    }

    if (needsAcquisition && (!entry || entry.rows.length === 0)) {
      issues.push({
        code: 'acquisition_missing',
        message: `Manca UC acquisizione per selettore «${col.headerLabel}».`,
        blocking: true,
      });
    } else if (needsAcquisition && entry?.rows.some((r) => !String(r.say ?? '').trim())) {
      issues.push({
        code: 'acquisition_say_missing',
        message: `Messaggio assistant mancante nell'UC acquisizione per «${col.headerLabel}».`,
        blocking: true,
      });
    }

    const informEntry = runtimeIndex.inform?.[col.columnId];
    if (needsInform && (!informEntry || informEntry.rows.length === 0)) {
      issues.push({
        code: 'inform_missing',
        message: `Manca UC inform per selettore «${col.headerLabel}» (informOnAutofill attivo).`,
        blocking: true,
      });
    }
  }

  if (runtimeIndex.correction.length === 0 && askable.length >= 2) {
    issues.push({
      code: 'correction_missing',
      message: 'Nessun UC correzione generato (servono almeno 2 selettori).',
      blocking: true,
    });
  }

  if (!runtimeIndex.complete?.sayTemplate?.trim()) {
    issues.push({
      code: 'complete_template_missing',
      message: 'Template complete mancante.',
      blocking: true,
    });
  }

  const completeBindings = uniqueCompleteBindings(grid, askable);
  for (const binding of completeBindings) {
    for (const [colId, raw] of Object.entries(binding)) {
      const label = getNaturalLabel(colId, raw, valueLabels);
      if (!label.trim()) {
        issues.push({
          code: 'complete_label_missing',
          message: `Label naturale mancante per ${colId}=${raw}.`,
          blocking: true,
        });
      }
    }

    const filtered = filterRowsByBinding(grid, binding);
    const matched = filtered[0];
    const { sayCore, unresolved } = interpolateCompleteTemplate({
      template: runtimeIndex.completeTemplate,
      binding,
      grid,
      matchedRow: matched,
      valueLabels,
    });

    if (unresolved.length > 0) {
      issues.push({
        code: 'complete_placeholder_unresolved',
        message: `Placeholder non risolti per binding ${JSON.stringify(binding)}: ${unresolved.join(', ')}.`,
        blocking: true,
      });
    }

    if (looksUnnaturalCompleteSay(sayCore)) {
      issues.push({
        code: 'complete_unnatural',
        message: `Frase complete innaturale: «${sayCore.slice(0, 80)}»`,
        blocking: false,
      });
    }
  }

  if (completeBindings.length === 0) {
    issues.push({
      code: 'no_complete_bindings',
      message: 'Nessun binding completo raggiungibile nella tabella KB.',
      blocking: true,
    });
  }

  return issues;
}

export function hasBlockingKbDialogGapIssues(issues: readonly KbDialogGapIssue[]): boolean {
  return issues.some((i) => i.blocking);
}
