import { DataExtractor } from '../types';
import { normalizeText } from './base';
import nlp from 'compromise';
import nlpDates from 'compromise-dates';
// @ts-ignore
nlp.extend(nlpDates);

export type DOB = { day?: number; month?: number; year?: number };

function parseYear(s: string): number | undefined {
  const m = s.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : undefined;
}

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
};

function parseMonth(s: string): number | undefined {
  for (const k of Object.keys(MONTHS)) if (s.includes(k)) return MONTHS[k];
}

function parseDay(s: string): number | undefined {
  const m = s.match(/\b(?:il\s+)?(?:giorn?[oa]\s+)?(\d{1,2})\b/);
  if (!m) return undefined;
  const d = parseInt(m[1], 10);
  if (d >= 1 && d <= 31) return d;
}

export const dateOfBirthExtractor: DataExtractor<DOB> = {
  extract(text, prev) {
    const s = normalizeText(text);
    try {
      // Try compromise dates to enrich parsing
      const doc = nlp(text);
      const dates = (doc as any).dates().json({ partial: true }) as any[];
      if (dates && dates.length > 0) {
        const parts = (dates[0] && (dates[0] as any).parts) || {};
        if (!year && parts.year) year = Number(parts.year);
        if (!month && parts.month) month = Number(parts.month);
        if (!day && parts.day) day = Number(parts.day);
      }
    } catch {}
    const year = parseYear(s) ?? prev?.year;
    const month = parseMonth(s) ?? prev?.month;
    const day = parseDay(s) ?? prev?.day;

    const missing: string[] = [];
    if (!day) missing.push('day');
    if (!month) missing.push('month');
    if (!year) missing.push('year');

    const complete = missing.length === 0;
    const confidence = complete ? 0.95 : 0.6;
    return { value: { day, month, year }, confidence, missing, reasons: complete ? [] : ['partial'] };
  },
  validate(v) {
    if (!v || !v.day || !v.month || !v.year) return { ok: false, errors: ['incomplete'] };
    const d = new Date(v.year, v.month - 1, v.day);
    const ok = d.getFullYear() === v.year && d.getMonth() === v.month - 1 && d.getDate() === v.day;
    return ok ? { ok: true } : { ok: false, errors: ['invalid-date'] };
  },
  format(v) {
    if (!v || !v.day || !v.month || !v.year) return '';
    return `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}`;
  }
};


