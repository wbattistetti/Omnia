/**
 * Messaggi di errore quando righe SEND non hanno campo API e/o binding costante|variabile (compile-time).
 * Con `backendCallSpecMeta.openapiSendBinding` (da `x-omnia.sendBinding`) applica opzionali e gruppi one-of.
 */

import type { OpenApiSendBindingRules } from '../backendCatalog/catalogTypes';
import { TaskType, type Task } from '../../types/taskTypes';

type SendRow = {
  internalName?: string;
  apiParam?: string;
  variable?: string;
};

function rowHasBindingValue(row: SendRow): boolean {
  return Boolean(String(row.variable ?? '').trim());
}

function readInputs(task: Task): SendRow[] {
  return (
    (task as Task & { inputs?: SendRow[] }).inputs ?? []
  ).filter((r) => Boolean(r?.internalName?.trim()));
}

function legacyIncompleteKeys(inputs: SendRow[]): string[] {
  const keys: string[] = [];
  for (const row of inputs) {
    const iname = row.internalName?.trim();
    if (!iname) continue;
    const api = row.apiParam?.trim();
    const variable = row.variable?.trim();
    if (!api || !variable) keys.push(iname);
  }
  return keys;
}

function incompleteKeysWithRules(inputs: SendRow[], rules: OpenApiSendBindingRules): string[] {
  const optional = new Set(rules.optionalApiParams ?? []);
  const incomplete = new Set<string>();

  for (const row of inputs) {
    const iname = row.internalName?.trim();
    if (!iname) continue;
    const api = row.apiParam?.trim();
    if (!api) {
      incomplete.add(iname);
      continue;
    }
    if (optional.has(api)) continue;

    const inGroup = rules.requireOneOfSets?.some((s) =>
      s.alternatives.some((a) => a.allApiParams.includes(api))
    );
    if (inGroup) continue;

    if (!rowHasBindingValue(row)) incomplete.add(iname);
  }

  for (const set of rules.requireOneOfSets ?? []) {
    const satisfied = set.alternatives.some((alt) =>
      alt.allApiParams.every((param) => {
        const row = inputs.find((r) => r.apiParam?.trim() === param);
        return row && rowHasBindingValue(row);
      })
    );
    if (satisfied) continue;

    const unionApis = new Set<string>();
    for (const alt of set.alternatives) {
      for (const p of alt.allApiParams) {
        if (!optional.has(p)) unionApis.add(p);
      }
    }
    for (const api of unionApis) {
      const row = inputs.find((r) => r.apiParam?.trim() === api);
      const iname = row?.internalName?.trim();
      if (!iname) continue;
      if (!rowHasBindingValue(row!)) incomplete.add(iname);
    }
  }

  return [...incomplete];
}

/** internalName delle righe SEND ancora da completare (campo API e/o binding). */
export function listIncompleteBackendSendWireKeys(task: Task): string[] {
  if (task.type !== TaskType.BackendCall) return [];
  const inputs = readInputs(task);
  const raw = (task as Task & { backendCallSpecMeta?: { openapiSendBinding?: OpenApiSendBindingRules | null } })
    .backendCallSpecMeta?.openapiSendBinding;
  const rules = raw === null || raw === undefined ? undefined : raw;

  if (!rules) {
    return legacyIncompleteKeys(inputs);
  }

  return incompleteKeysWithRules(inputs, rules);
}

export function collectBackendCallIncompleteSendMessages(task: Task): string[] {
  if (task.type !== TaskType.BackendCall) return [];
  const inputs = readInputs(task);
  const missing = new Set(listIncompleteBackendSendWireKeys(task));
  const msgs: string[] = [];
  for (const row of inputs) {
    const iname = row.internalName?.trim();
    if (!iname || !missing.has(iname)) continue;
    const api = row.apiParam?.trim();
    const variable = row.variable?.trim();
    if (!api && !variable) {
      msgs.push(`Backend Call · SEND «${iname}»: mappa il campo API e indica costante o variabile.`);
    } else if (!api) {
      msgs.push(`Backend Call · SEND «${iname}»: mappa il campo API (nome parametro OpenAPI).`);
    } else if (!variable) {
      msgs.push(
        `Backend Call · SEND «${iname}» (${api}): obbligatorio costante o variabile di flusso — nessun default implicito.`
      );
    }
  }
  return msgs;
}
