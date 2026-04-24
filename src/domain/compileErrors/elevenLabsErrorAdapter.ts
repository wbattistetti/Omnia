/**
 * Maps ElevenLabs ConvAI / proxy errors into {@link NormalizedIaProviderError}.
 */

import type { NormalizedIaProviderError, ProviderErrorAdapter } from './iaProviderErrors';

function stringifyUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Pull JSON payload after Omnia client ` — ` separator or parse whole blob. */
function tryParseEmbeddedJson(blob: string): unknown {
  const sep = ' — ';
  let tail = blob.includes(sep) ? blob.split(sep).slice(1).join(sep).trim() : blob.trim();
  const hintIdx = tail.indexOf(' [ElevenLabs API base:');
  if (hintIdx >= 0) tail = tail.slice(0, hintIdx).trim();
  try {
    return JSON.parse(tail);
  } catch {
    return null;
  }
}

function extractMessageAndCode(parsed: unknown): { message: string; code: string } {
  let message = 'Errore ElevenLabs sconosciuto';
  let code = 'unknown';

  if (parsed == null) {
    return { message, code };
  }

  if (typeof parsed === 'string') {
    return { message: parsed || message, code };
  }

  if (typeof parsed !== 'object') {
    return { message: String(parsed), code };
  }

  const o = parsed as Record<string, unknown>;
  const detail = o.detail ?? o.details;

  if (typeof detail === 'string') {
    message = detail;
  } else if (Array.isArray(detail)) {
    const parts: string[] = [];
    for (const item of detail) {
      if (item && typeof item === 'object' && 'msg' in item) {
        parts.push(String((item as { msg?: unknown }).msg ?? '').trim());
      } else if (typeof item === 'string') {
        parts.push(item.trim());
      }
    }
    const joined = parts.filter(Boolean).join('; ');
    if (joined) message = joined;
  } else if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.msg === 'string') message = d.msg;
    if (typeof d.message === 'string') message = d.message;
    if (typeof d.code === 'string') code = d.code;
  }

  const nestedDetail =
    typeof o.details === 'object' &&
    o.details !== null &&
    typeof (o.details as Record<string, unknown>).detail === 'object'
      ? (o.details as Record<string, unknown>).detail
      : null;
  if (nestedDetail && typeof nestedDetail === 'object') {
    const nd = nestedDetail as Record<string, unknown>;
    if (typeof nd.message === 'string') message = nd.message;
    if (typeof nd.msg === 'string') message = nd.msg;
    if (typeof nd.code === 'string') code = nd.code;
  }

  return { message: message.trim() || 'Errore ElevenLabs sconosciuto', code };
}

export const elevenLabsErrorAdapter: ProviderErrorAdapter = {
  provider: 'elevenlabs',

  canHandle(err: unknown): boolean {
    const raw = stringifyUnknown(err).toLowerCase();
    if (raw.includes('non-english agents')) return true;
    if (raw.includes('elevenlabs agents/create failed')) return true;
    if (raw.includes('invalid conversation config')) return true;
    if (raw.includes('elevenlabs') && (raw.includes('convai') || raw.includes('/v1/convai'))) return true;
    return false;
  },

  normalize(err: unknown): NormalizedIaProviderError {
    const blob = stringifyUnknown(err);
    let parsed = tryParseEmbeddedJson(blob);
    if (parsed == null && typeof err === 'object' && err !== null) {
      const o = err as Record<string, unknown>;
      if (typeof o.details === 'string') {
        parsed = tryParseEmbeddedJson(o.details);
      }
    }

    const { message, code } = extractMessageAndCode(parsed ?? blob);

    return {
      provider: 'elevenlabs',
      code,
      message,
      raw: err,
    };
  },

  inferFixAction(normalized: NormalizedIaProviderError): string {
    const m = normalized.message.toLowerCase();
    if (m.includes('language')) return 'open_elevenlabs_language';
    if (m.includes('turbo') || m.includes('flash') || m.includes('v2_5')) return 'open_elevenlabs_model';
    if (m.includes('voice')) return 'open_elevenlabs_voice';
    return 'open_elevenlabs_panel';
  },
};
