import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DataExtractor } from '../types';
import { normalizeText } from './base';

export type Phone = { e164: string };

export const phoneExtractor: DataExtractor<Phone> = {
  extract(text) {
    const s = normalizeText(text).replace(/\s+/g, ' ');
    const digits = s.replace(/[^\d+]/g, '');
    const p = parsePhoneNumberFromString(digits, 'IT');
    if (p?.isValid()) return { value: { e164: p.number }, confidence: 0.95 };
    return { confidence: 0.4, reasons: ['no-valid-phone'] };
  },
  validate(v) {
    const p = parsePhoneNumberFromString(v.e164);
    return p?.isValid() ? { ok: true } : { ok: false, errors: ['invalid-phone'] };
  },
  format(v) { return v.e164; }
};



