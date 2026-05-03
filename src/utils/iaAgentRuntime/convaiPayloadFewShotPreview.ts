/**
 * Estrae dal JSON createAgent ConvAI il testo prompt e la parte few-shot (sezione IR «Examples»)
 * per anteprima/debug nel modal payload — non usato a runtime.
 */

import { splitExpandedAtExamplesMarkdown } from '@domain/agentPrompt/compilePrompt';

export type ConvaiFewShotPreviewResult =
  | {
      kind: 'ok';
      /** Testo completo di conversation_config.agent.prompt.prompt */
      fullPrompt: string;
      /** Corpo dopo `### Examples` nel markdown del prompt (few-shot compilato). */
      examplesBody: string;
      hasExamples: boolean;
    }
  | { kind: 'error'; message: string };

function extractPromptFromConvaiPayload(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const cc = o.conversation_config;
  if (!cc || typeof cc !== 'object') return null;
  const agent = (cc as Record<string, unknown>).agent;
  if (!agent || typeof agent !== 'object') return null;
  const promptObj = (agent as Record<string, unknown>).prompt;
  if (!promptObj || typeof promptObj !== 'object') return null;
  const p = (promptObj as Record<string, unknown>).prompt;
  return typeof p === 'string' ? p : null;
}

/** JSON valido inizia con { [ " t f n - 0-9 — mai con // */
function looksLikeCommentOnlyPayload(s: string): boolean {
  const t = s.trim();
  return t.startsWith('//');
}

/**
 * Quando JSON.parse fallisce (es. escape rotti nel testo del prompt lato upstream),
 * estrae il valore stringa di `conversation_config.agent.prompt.prompt` scansionando le escape JSON.
 */
export function extractInnerPromptStringLoose(raw: string): string | null {
  const re =
    /"conversation_config"\s*:\s*\{[\s\S]*?"agent"\s*:\s*\{[\s\S]*?"prompt"\s*:\s*\{[\s\S]*?"prompt"\s*:\s*"/;
  const m = re.exec(raw);
  if (!m) return null;
  let i = m.index + m[0].length;
  let out = '';
  while (i < raw.length) {
    const c = raw[i];
    if (c === '\\') {
      if (i + 1 >= raw.length) return null;
      const n = raw[i + 1];
      if (n === 'u') {
        if (i + 6 > raw.length) return null;
        const hex = raw.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      switch (n) {
        case '"':
          out += '"';
          break;
        case '\\':
          out += '\\';
          break;
        case '/':
          out += '/';
          break;
        case 'b':
          out += '\b';
          break;
        case 'f':
          out += '\f';
          break;
        case 'n':
          out += '\n';
          break;
        case 'r':
          out += '\r';
          break;
        case 't':
          out += '\t';
          break;
        default:
          out += n;
          break;
      }
      i += 2;
      continue;
    }
    if (c === '"') {
      return out;
    }
    out += c;
    i += 1;
  }
  return null;
}

function tryParsePayloadRoot(payloadJson: string): unknown | null {
  const t = payloadJson.replace(/^\uFEFF/, '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function fewShotOkFromFullPrompt(fullPrompt: string): ConvaiFewShotPreviewResult {
  const { examples } = splitExpandedAtExamplesMarkdown(fullPrompt);
  const examplesBody = examples.trim();
  return {
    kind: 'ok',
    fullPrompt,
    examplesBody,
    hasExamples: examplesBody.length > 0,
  };
}

/**
 * Dal body JSON inviato a ElevenLabs agents/create, ricava prompt + flag presenza Examples.
 */
export function parseConvaiCreateAgentFewShotPreview(payloadJson: string): ConvaiFewShotPreviewResult {
  const trimmed = payloadJson.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { kind: 'error', message: 'Payload vuoto.' };
  }
  if (looksLikeCommentOnlyPayload(trimmed)) {
    return {
      kind: 'error',
      message:
        'Questo blocco non è JSON (inizia con //): è un placeholder di debug o un messaggio di errore, non il body ElevenLabs. Rigenera l’anteprima dopo createAgent o usa «Payload completo» se il server ha restituito elevenLabsRequestJson.',
    };
  }

  const parsed = tryParsePayloadRoot(trimmed);
  if (parsed !== null) {
    const fullPrompt = extractPromptFromConvaiPayload(parsed);
    if (fullPrompt === null) {
      return {
        kind: 'error',
        message:
          'Struttura JSON inattesa: manca conversation_config.agent.prompt.prompt (testo istruzioni ConvAI).',
      };
    }
    return fewShotOkFromFullPrompt(fullPrompt);
  }

  const loose = extractInnerPromptStringLoose(trimmed);
  if (loose !== null) {
    return fewShotOkFromFullPrompt(loose);
  }

  return {
    kind: 'error',
    message:
      'JSON non valido e impossibile estrarre il prompt con il fallback testuale. Il body potrebbe essere troncato o il formato API essere cambiato. Usa «Payload completo» e verifica il JSON (escape/newline nel campo prompt).',
  };
}

/** Testo da mostrare/copiare in modalità «solo few-shot». */
export function formatFewShotOnlyDisplay(parsed: ConvaiFewShotPreviewResult): string {
  if (parsed.kind === 'error') {
    return parsed.message;
  }
  if (!parsed.hasExamples) {
    return [
      'Nessuna sezione «Examples» nel prompt inviato a ElevenLabs.',
      '',
      'La sezione compare solo se il task ha contenuto nella sezione strutturata Examples dell’editor (compilata come ### Examples nel markdown del prompt).',
      '',
      'Nota: i dialoghi salvati negli use case del task non sono inclusi automaticamente in questo payload.',
    ].join('\n');
  }
  return ['### Examples', '', parsed.examplesBody].join('\n');
}

/**
 * Tab few-shot: parte ConvAI + opzionale blocco use case (solo anteprima dal task, non nel JSON).
 */
export function formatFewShotTabCombined(bodyText: string, useCaseDialoguesPreview?: string | undefined): string {
  const payloadPart = formatFewShotOnlyDisplay(parseConvaiCreateAgentFewShotPreview(bodyText));
  const uc = useCaseDialoguesPreview?.trim();
  if (!uc) {
    return payloadPart;
  }
  return [
    '══ Nel POST createAgent — sezione Examples del prompt (structured Examples) ══',
    '',
    payloadPart,
    '',
    '══ Sul task — use case (agentUseCasesJson; non inclusi nel POST salvo copia manuale in Examples) ══',
    '',
    uc,
  ].join('\n');
}
