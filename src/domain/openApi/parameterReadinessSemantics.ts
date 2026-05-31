/**
 * Classificazione semantica parametri per audit readiness OpenAPI / ConvAI:
 * distingue input SEND (mapping NL→valore) da output RECEIVE passivi vs interpretativi.
 */

import { inferSlotIdFromApiPath } from '@domain/backendOutputSlotBinding/inferSlotIdFromApiPath';

export type ReadinessSeverity = 'ok' | 'warning' | 'blocker';

export type ParameterFieldPresence = {
  type: boolean;
  format: boolean;
  enum: boolean;
  minMax: boolean;
  pattern: boolean;
  description: boolean;
  xAgentInstructions: boolean;
  xOpenaiIsConsequential: boolean;
};

export type ParameterAuditProfile =
  /** Parametro nel body/query del tool ConvAI: l'agente lo popola da linguaggio naturale. */
  | 'send-input'
  /** Output che l'agente legge e mappa in slot/dialogo (date, orari, score, vincoli). */
  | 'receive-interactive'
  /** Output backend-only: contatori, flag, metriche — nessuna conversione NL richiesta. */
  | 'receive-passive';

export type ParameterAuditContext = {
  path: string;
  direction: 'send' | 'receive';
  inConvaiTool: boolean;
  type: string;
  present: ParameterFieldPresence;
  format?: string;
};

function lastPathSegment(path: string): string {
  const normalized = path.replace(/\[\]/g, '.').replace(/\.$/, '');
  const parts = normalized.split('.').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Contatori e metriche RECEIVE (summary.totalSlots, freeSlots, …). */
export function isPassiveReceiveCounterPath(path: string, type: string): boolean {
  if (type !== 'integer' && type !== 'number') return false;
  const leaf = lastPathSegment(path);
  if (/^summary$/i.test(leaf)) return true;
  if (/\.summary\./i.test(path) || /^summary\./i.test(path)) return true;
  if (
    /^(total|count|free|used|num|size|length|remaining|available|occupied|pending)(slots|count|items|total|size|num)?$/i.test(
      leaf
    )
  ) {
    return true;
  }
  if (/^(totalSlots|freeSlots|totalCount|itemCount|slotCount|pages|pageSize|offset|limit)$/i.test(leaf)) {
    return true;
  }
  return false;
}

function isStructuralContainerType(type: string): boolean {
  return type === 'object' || type === 'array';
}

function isInteractiveReceiveByPath(path: string, type: string, format?: string): boolean {
  if (inferSlotIdFromApiPath(path)) return true;
  const p = path.toLowerCase();
  const leaf = lastPathSegment(p);
  if (/(score|preferred|interval|constraint|window|horizon|slot|agenda|availability)/.test(p)) {
    if (type === 'string' || type === 'integer' || type === 'number') return true;
  }
  if (type === 'string') {
    const fmt = (format ?? '').toLowerCase();
    if (/(date|time|email|uri|uuid)/.test(fmt)) return true;
    if (/(date|time|ora|orario|giorno|weekday|interval|preferred|score)/.test(p)) return true;
  }
  if (/(preferredtimeintervals|preferredintervals|allowedintervals|timeintervals)/.test(leaf)) {
    return true;
  }
  return false;
}

/**
 * Profilo audit: decide quali gap contano per l'agente ConvAI / catalogo slot.
 */
export function classifyParameterAuditProfile(ctx: ParameterAuditContext): ParameterAuditProfile {
  if (ctx.direction === 'send') return 'send-input';

  const t = ctx.type.toLowerCase();
  if (!t || isStructuralContainerType(t)) return 'receive-passive';
  if (t === 'boolean') return 'receive-passive';
  if (isPassiveReceiveCounterPath(ctx.path, t)) return 'receive-passive';

  if (isInteractiveReceiveByPath(ctx.path, t, ctx.format)) return 'receive-interactive';

  if (t === 'integer' || t === 'number') {
    if (ctx.present.minMax || ctx.present.enum) return 'receive-passive';
    return 'receive-passive';
  }

  if (t === 'string') {
    if (ctx.present.format || ctx.present.enum || ctx.present.pattern) return 'receive-interactive';
    return 'receive-passive';
  }

  return 'receive-passive';
}

export function auditNoteForProfile(profile: ParameterAuditProfile): string | undefined {
  switch (profile) {
    case 'send-input':
      return 'Input tool ConvAI: l’agente traduce frasi utente in questo valore.';
    case 'receive-interactive':
      return 'Output interpretativo: l’agente legge questo campo per dialogo / mapping catalogo.';
    case 'receive-passive':
      return 'Output backend: nessuna conversione da linguaggio naturale richiesta.';
  }
}

function needsNlMappingHints(type: string, present: ParameterFieldPresence): boolean {
  const t = type.toLowerCase();
  if (t === 'string' && !present.format && !present.enum && !present.pattern) return true;
  if ((t === 'integer' || t === 'number') && !present.minMax && !present.enum) return true;
  return false;
}

/** Messaggio gap contestualizzato per il team backend. */
export function buildNlMappingGapMessage(path: string, type: string): string {
  const leaf = lastPathSegment(path);
  const p = path.toLowerCase();

  if (/(windowdays|window_days|numdays|daycount|horizon\.days|horizondays)/.test(p)) {
    return `${leaf}: aggiungere x-agent-instructions — mapping da frasi come «i prossimi 5 giorni» → numero giorni`;
  }
  if (/(horizon|window)/.test(p) && /(integer|number)/.test(type)) {
    return `${leaf}: aggiungere x-agent-instructions — es. «entro una settimana» → valore numerico`;
  }
  if (/(weekday|dayofweek|giornosettimana)/.test(p)) {
    return `${leaf}: aggiungere x-agent-instructions — es. «lunedì» → codice weekday`;
  }
  if (type === 'string' && /(date|data|horizon\.start|horizon\.end)/.test(p)) {
    return `${leaf}: aggiungere x-agent-instructions — es. «domani», «15 maggio» → data ISO`;
  }
  if (type === 'string' && /(time|ora|orario|interval|preferred)/.test(p)) {
    return `${leaf}: aggiungere x-agent-instructions — es. «mattina», «dopo le 15» → fascia/orario`;
  }
  if (/(preferredtimeintervals|preferredintervals|allowedintervals|constraints)/.test(p)) {
    return `${leaf}: l’agente interpreta vincoli/fasce — documentare con x-agent-instructions ed esempi NL`;
  }
  if (/(score|rank|rating)/.test(p)) {
    return `${leaf}: output usato dall’agente — descrivere scala/significato in description o x-agent-instructions`;
  }
  return `${leaf}: aggiungere x-agent-instructions per tradurre frasi utente in valore strutturato`;
}

export type BuildParameterGapsInput = {
  path: string;
  direction: 'send' | 'receive';
  inConvaiTool: boolean;
  type: string;
  present: ParameterFieldPresence;
  format?: string;
  compileIssue?: string;
};

export type ParameterGapsResult = {
  gaps: string[];
  severity: ReadinessSeverity;
  profile: ParameterAuditProfile;
  auditNote: string;
};

/**
 * Gap e severità mirati: BLOCKER solo su SEND schema incompleto; WARNING su mapping NL mancante.
 */
export function buildParameterGaps(input: BuildParameterGapsInput): ParameterGapsResult {
  const profile = classifyParameterAuditProfile(input);
  const auditNote = auditNoteForProfile(profile) ?? '';
  const gaps: string[] = [];
  const t = input.type.toLowerCase();

  if (input.compileIssue && profile === 'send-input') {
    gaps.push(input.compileIssue);
  } else if (input.compileIssue && profile === 'receive-interactive') {
    if (input.compileIssue.includes('senza format') || input.compileIssue.includes('manca type')) {
      gaps.push(input.compileIssue.replace(' — spec incompleta', '') + ' (output interpretativo)');
    }
  }

  if (profile === 'receive-passive') {
    return { gaps: [], severity: 'ok', profile, auditNote };
  }

  if (profile === 'send-input') {
    if (!input.present.type) gaps.push('manca type (obbligatorio nel tool ConvAI)');
    if (isStructuralContainerType(t)) {
      if (!input.inConvaiTool) {
        gaps.push('parametro SEND non presente nello schema tool ElevenLabs dopo adattamento');
      }
      let severity: ReadinessSeverity = gaps.some(
        (g) => g.includes('manca type') || g.includes('non presente nello schema tool')
      )
        ? 'blocker'
        : gaps.length > 0
          ? 'warning'
          : 'ok';
      if (input.compileIssue && severity !== 'blocker') severity = 'blocker';
      return {
        gaps,
        severity,
        profile,
        auditNote: 'Contenitore object/array: audit sui campi annidati elencati sotto.',
      };
    }
    if (t === 'string' && !input.present.format && !input.present.enum && !input.present.pattern) {
      gaps.push(
        `${lastPathSegment(input.path)}: string SEND senza format, enum o pattern — l’agente non sa che valori accettare`
      );
    }
    if ((t === 'integer' || t === 'number') && needsNlMappingHints(t, input.present)) {
      gaps.push(
        `${lastPathSegment(input.path)}: manca minimum/maximum o enum (es. weekday 0–6, giorni 1–30)`
      );
    }
    if (!input.inConvaiTool) {
      gaps.push('parametro SEND non presente nello schema tool ElevenLabs dopo adattamento');
    }
    if (needsNlMappingHints(t, input.present) && !input.present.xAgentInstructions) {
      gaps.push(buildNlMappingGapMessage(input.path, t));
    } else if (
      needsNlMappingHints(t, input.present) &&
      !input.present.description
    ) {
      gaps.push(
        `${lastPathSegment(input.path)}: aggiungere description con esempi NL (es. «domani»→data)`
      );
    }
  }

  if (profile === 'receive-interactive') {
    if (!input.present.type) {
      gaps.push(`${lastPathSegment(input.path)}: manca type su output interpretativo`);
    }
    if (t === 'string' && !input.present.format && !input.present.enum && !input.present.pattern) {
      gaps.push(
        `${lastPathSegment(input.path)}: string RECEIVE interpretativa senza format/enum — difficile mappare in catalogo slot`
      );
    }
    if (!input.present.description) {
      const slotHint = inferSlotIdFromApiPath(input.path);
      if (slotHint) {
        gaps.push(
          `${lastPathSegment(input.path)}: aggiungere description — l’agente mappa questo output nello slot «${slotHint}» (es. come presentarlo in dialogo)`
        );
      } else {
        gaps.push(
          `${lastPathSegment(input.path)}: aggiungere description — output interpretativo usato dall’agente in dialogo/catalogo`
        );
      }
    }
  }

  let severity: ReadinessSeverity = 'ok';
  const isBlockerGap = (g: string) =>
    g.includes('manca type') ||
    g.includes('senza format, enum o pattern') ||
    g.includes('string SEND senza') ||
    g.includes('non presente nello schema tool') ||
    (profile === 'send-input' && Boolean(input.compileIssue));

  if (gaps.some(isBlockerGap)) {
    severity = 'blocker';
  } else if (gaps.length > 0) {
    severity = 'warning';
  }

  return { gaps, severity, profile, auditNote };
}
