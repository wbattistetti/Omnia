/**
 * Strato C: messaggi UX da chiave canonica + contesto (nessun testo compilatore come fonte primaria).
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import { splitFlowPrefixedMessage, withFlowPrefix } from '@utils/flowPrefixedMessage';
import { getDialogueStepUserLabel, ordinalItalianEscalation } from '@utils/dialogueStepUserLabels';
import type { CompileMessageKey } from './compileMessageKeys';
import { KNOWN_COMPILE_MESSAGE_KEYS } from './compileMessageKeys';

const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:[-_][a-zA-Z0-9]+)?/g;

export interface CompileErrorContext {
  taskId: string;
  rowId?: string;
  rowLabel?: string;
  rowDisplayLabel?: string;
  nodeId?: string;
  edgeId?: string;
  stepKey?: string;
  escalationIndex?: number;
  reason?: string;
  detailCode?: string;
  technicalDetail?: string;
  /** Stripped compiler body when key is LegacyUnknown */
  rawCleanedBody?: string;
}

export interface NormalizedCompileError {
  key: CompileMessageKey;
  ctx: CompileErrorContext;
}

function truncateDisplayLabel(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

function stripNodeRowRefs(message: string): string {
  let m = message;
  m = m.replace(/\s+in\s+node\s+[0-9a-fA-F-]+(?:\s*,\s*row\s+[0-9a-fA-F-]+)?/gi, '');
  m = m.replace(/\s*,\s*row\s+[0-9a-fA-F-]+/gi, '');
  m = m.replace(UUID_RE, '');
  m = m.replace(/\s+/g, ' ').trim();
  m = m.replace(/^[.,;:]\s*|[.,;:]+$/g, '');
  return m;
}

function haystack(error: CompilationError): string {
  const tech = (error.technicalDetail ?? '').toLowerCase();
  const body = splitFlowPrefixedMessage(error.message).body.toLowerCase();
  return `${tech} ${body}`;
}

function missingDataContractHeuristic(error: CompilationError): boolean {
  const cat = (error.category ?? '').trim();
  if (cat !== 'TaskCompilationFailed' && cat !== 'CompilationException') return false;
  const { body } = splitFlowPrefixedMessage(error.message);
  return /missing\s+data\s+contract/i.test(body);
}

function parseIncomingCode(raw: string | undefined): CompileMessageKey | undefined {
  const c = (raw ?? '').trim();
  if (!c) return undefined;
  if (KNOWN_COMPILE_MESSAGE_KEYS.has(c)) return c as CompileMessageKey;
  return undefined;
}

/**
 * Ricava chiave canonica da payload (priorità: campo `code`, poi legacy category/detail/reason).
 */
export function normalizeCompilerError(error: CompilationError): NormalizedCompileError {
  const fromPayload = parseIncomingCode((error as { code?: string }).code);
  if (fromPayload) {
    return {
      key: fromPayload,
      ctx: baseCtx(error),
    };
  }

  const cat = (error.category ?? '').trim();
  const detail = (error.detailCode ?? '').trim();
  const ctx = baseCtx(error);

  if (missingDataContractHeuristic(error)) {
    return { key: 'ParserMissing', ctx };
  }

  if (cat === 'MissingDataContract') return { key: 'ParserMissing', ctx };
  if (cat === 'NlpContractInvalid') return { key: 'ContractInvalid', ctx };
  if (cat === 'EmptyInterpretationEngines') return { key: 'ParserMissing', ctx };
  if (cat === 'CanonicalGuidResolution') return { key: 'TaskInvalidReferences', ctx };

  if (cat === 'TaskCompilationFailed' || cat === 'CompilationException') {
    if (detail === 'TemplateNotFound') return { key: 'TemplateNotFound', ctx };
    if (detail === 'InvalidContract') return { key: 'ContractInvalid', ctx };
    if (detail === 'JsonError') return { key: 'JsonStructureInvalid', ctx };

    const h = haystack(error);
    if (h.includes('not found in alltemplates') || (h.includes('template') && h.includes('not found'))) {
      return { key: 'TemplateNotFound', ctx };
    }
    if (
      h.includes('datacontract') ||
      h.includes('invalidcontract') ||
      h.includes('missing datacontract')
    ) {
      return { key: 'ContractIncomplete', ctx };
    }
    if (h.includes('json') && (h.includes('parse') || h.includes('unexpected'))) {
      return { key: 'JsonStructureInvalid', ctx };
    }
    return { key: 'TaskDataInvalid', ctx };
  }

  if (cat === 'MissingOrInvalidTask' || cat === 'TaskNotFound' || cat === 'MissingTaskId' || cat === 'Task not found') {
    return { key: 'FlowRowNoTask', ctx };
  }
  if (cat === 'TaskTypeInvalidOrMissing' || cat === 'MissingTaskType' || cat === 'InvalidTaskType') {
    return { key: 'TaskTypeUndefined', ctx };
  }
  if (cat === 'NoEntryNodes') return { key: 'FlowNoEntry', ctx };
  if (cat === 'MultipleEntryNodes') return { key: 'FlowMultipleEntry', ctx };

  if (
    cat === 'ConditionNotFound' ||
    cat === 'ConditionMissingScript' ||
    cat === 'ConditionHasNoScript' ||
    cat === 'LinkMissingCondition' ||
    cat === 'EdgeLabelWithoutCondition' ||
    cat === 'EdgeWithoutCondition'
  ) {
    return { key: 'LinkConditionMissing', ctx };
  }

  const reason = (error.reason ?? '').trim();
  if (cat === 'AmbiguousLink') {
    if (reason === 'sameLabel') return { key: 'LinkDuplicateLabel', ctx };
    if (reason === 'sameCondition') return { key: 'LinkDuplicateCondition', ctx };
    if (reason === 'overlappingConditions') return { key: 'LinkRulesIndistinguishable', ctx };
    return { key: 'LinkConditionMissing', ctx };
  }
  if (cat === 'AmbiguousOutgoingLinks') return { key: 'LinksNotMutuallyExclusive', ctx };
  if (cat === 'AmbiguousDuplicateEdgeLabels') return { key: 'LinkDuplicateLabel', ctx };
  if (cat === 'AmbiguousDuplicateConditionScript') return { key: 'LinkDuplicateConditionScript', ctx };
  if (cat === 'EmptyEscalation') return { key: 'EscalationMessageMissing', ctx };

  const { body } = splitFlowPrefixedMessage(error.message);
  const cleaned = stripNodeRowRefs(body);
  if (cleaned.length > 8) {
    ctx.rawCleanedBody = cleaned;
    return { key: 'LegacyUnknown', ctx };
  }

  return { key: 'TaskNotCompilableGeneric', ctx };
}

function baseCtx(error: CompilationError): CompileErrorContext {
  const rowLab = ((error as { rowLabel?: string }).rowLabel ?? '').trim();
  return {
    taskId: error.taskId,
    rowId: error.rowId,
    rowLabel: rowLab || undefined,
    nodeId: error.nodeId,
    edgeId: error.edgeId,
    stepKey: error.stepKey,
    escalationIndex: error.escalationIndex,
    reason: error.reason,
    detailCode: error.detailCode,
    technicalDetail: error.technicalDetail,
  };
}

/**
 * Messaggio UX finale (senza prefisso [flow]).
 */
export function resolveMessage(key: CompileMessageKey, ctx: CompileErrorContext): string {
  const rowName = truncateDisplayLabel((ctx.rowDisplayLabel || ctx.rowLabel || '').trim() || 'questa riga', 200);

  switch (key) {
    case 'ParserMissing':
      return 'Parser mancante.';
    case 'TemplateNotFound':
      return 'Template non trovato.';
    case 'ContractInvalid':
      return 'Contratto dati non valido.';
    case 'JsonStructureInvalid':
      return 'Struttura JSON non valida.';
    case 'ContractIncomplete':
      return 'Contratto dati incompleto.';
    case 'TaskDataInvalid':
      return 'Dati task non validi.';
    case 'FlowRowNoTask':
      return `Per «${rowName}» non è definito il task.`;
    case 'TaskTypeUndefined':
      return 'Il tipo di task non è definito.';
    case 'SubflowChildNotRunnable':
      return 'Il flusso collegato al task è vuoto.';
    case 'FlowNoEntry':
      return 'Il flusso non ha un nodo di start.';
    case 'FlowMultipleEntry':
      return 'Il flusso ha più nodi di start.';
    case 'LinkConditionMissing':
      return 'Manca la condizione per il link.';
    case 'LinkDuplicateLabel':
      return 'Link con etichetta ripetuta.';
    case 'LinkDuplicateCondition':
      return 'Link con condizione ripetuta.';
    case 'LinkRulesIndistinguishable':
      return 'Regole di uscita indistinguibili.';
    case 'LinksNotMutuallyExclusive':
      return 'I link non sono mutuamente esclusivi.';
    case 'LinkDuplicateConditionScript':
      return 'Condizione o script duplicato.';
    case 'EscalationMessageMissing': {
      const stepLabel = getDialogueStepUserLabel(ctx.stepKey);
      const ordinal = ordinalItalianEscalation(ctx.escalationIndex);
      return `Manca il messaggio nel ${ordinal} tentativo di «${stepLabel}».`;
    }
    case 'EscalationNoTermination':
      return 'Escalation senza condizione di terminazione.';
    case 'ResponseMessageMissing':
      return 'Manca il messaggio di risposta.';
    case 'VariableNameMissing':
      return 'Nome variabile mancante.';
    case 'VariableDuplicate':
      return 'Variabile duplicata.';
    case 'TranslationOwnerMissing':
      return 'Manca il campo owner nelle traduzioni.';
    case 'TranslationDefaultMissing':
      return 'Traduzione mancante per la lingua predefinita.';
    case 'TaskInvalidReferences':
      return 'Il task contiene riferimenti non validi.';
    case 'TaskRefNotFound':
      return 'Task di riferimento non trovato.';
    case 'NodeRefNotFound':
      return 'Nodo di riferimento non trovato.';
    case 'NlpContractInvalid':
      return 'Contratto dati non valido.';
    case 'EmptyInterpretationEngines':
      return 'Parser mancante.';
    case 'CanonicalGuidResolution':
      return 'Il task contiene riferimenti non validi.';
    case 'EmptyValueNotAllowed':
      return 'Valore vuoto non ammesso.';
    case 'TaskNotCompilableGeneric':
      return 'Il task non è compilabile: correggi i campi evidenziati.';
    case 'LegacyUnknown':
      if (ctx.rawCleanedBody && ctx.rawCleanedBody.length > 8) {
        return ctx.rawCleanedBody;
      }
      return 'Il task non è compilabile: correggi i campi evidenziati.';
    default:
      return 'Il task non è compilabile: correggi i campi evidenziati.';
  }
}

export interface ResolveCompilationMessageOptions {
  /** Row title from workspace when not on error payload */
  rowText?: string | null;
}

/**
 * Messaggio con prefisso flow opzionale da `error.message`.
 */
export function resolveCompilationUserMessage(
  error: CompilationError,
  opts: ResolveCompilationMessageOptions = {}
): string {
  const normalized = normalizeCompilerError(error);
  const rowDisplay =
    (opts.rowText ?? '').trim() ||
    (normalized.ctx.rowLabel ?? '').trim() ||
    (error.rowLabel ?? '').trim();
  const ctx: CompileErrorContext = {
    ...normalized.ctx,
    rowDisplayLabel: rowDisplay || normalized.ctx.rowDisplayLabel,
  };
  const body = resolveMessage(normalized.key, ctx);
  const { flowTag } = splitFlowPrefixedMessage(error.message);
  return withFlowPrefix(flowTag, body);
}

/** True when technical raw line should be hidden (copy already in main message). */
export function shouldSuppressTechnicalDetailForError(error: CompilationError): boolean {
  return missingDataContractHeuristic(error);
}
