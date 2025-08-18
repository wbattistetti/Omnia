import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DataExtractor } from '../types';
import { normalizeText } from './base';

export type Phone = { e164: string };

export const phoneExtractor: DataExtractor<Phone> = {
  extract(text) {
    const raw = String(text || '');
    const norm = normalizeText(raw).replace(/\s+/g, ' ');
    const only = raw.replace(/[^\d+]/g, '');
    // eslint-disable-next-line no-console
    console.log('[NLP][phone][extract] input', { raw, norm, only });
    let parsed = parsePhoneNumberFromString(only, 'IT');
    if (!parsed && only.startsWith('00')) parsed = parsePhoneNumberFromString('+' + only.slice(2), 'IT');
    if (!parsed && only.startsWith('39')) parsed = parsePhoneNumberFromString('+' + only, 'IT');
    if (!parsed && !only.startsWith('+') && /^3\d{8,}$/.test(only)) parsed = parsePhoneNumberFromString('+39' + only, 'IT');
    // eslint-disable-next-line no-console
    console.log('[NLP][phone][extract] parsed', { valid: parsed?.isValid?.(), number: parsed?.number });
    if (parsed?.isValid()) return { value: { e164: parsed.number }, confidence: 0.95 };
    return { confidence: 0.4, reasons: ['no-valid-phone'] };
  },
  validate(v) {
    const p = parsePhoneNumberFromString(v.e164);
    const ok = Boolean(p?.isValid());
    // eslint-disable-next-line no-console
    console.log('[NLP][phone][validate]', { input: v?.e164, valid: ok });
    return ok ? { ok: true } : { ok: false, errors: ['invalid-phone'] };
  },
  format(v) { 
    // eslint-disable-next-line no-console
    console.log('[NLP][phone][format]', { e164: v?.e164 });
    return v.e164; 
  }
};



