import isEmail from 'validator/lib/isEmail';
import { DataExtractor } from '../types';
import { normalizeText } from './base';

export type Email = string;

export const emailExtractor: DataExtractor<Email> = {
  extract(text) {
    const s = normalizeText(text);
    const norm = s.replace(/\bchiocciola\b/g, '@').replace(/\bpunto\b/g, '.');
    const m = norm.match(/[^\s]+@[^\s]+\.[^\s]+/);
    if (m && isEmail(m[0])) return { value: m[0], confidence: 0.95 };
    return { confidence: 0.4, reasons: ['no-valid-email'] };
  },
  validate(v) { return isEmail(v) ? { ok: true } : { ok: false, errors: ['invalid-email'] }; },
  format(v) { return v.toLowerCase(); }
};


