// Lightweight validators with graceful fallback (no external deps required)
// If in the future you install "compromise" (nlp-compromise), you can enhance these.

export function isLikelyFullName(input: string): boolean {
  const s = String(input || '').trim();
  if (!s) return false;
  // At least two alphabetic words, allow accents and apostrophes
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every(w => /^(?=.{2,})[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(w));
}

export function isLikelyEmail(input: string): boolean {
  const s = String(input || '').trim();
  if (!s) return false;
  // Simple email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function isLikelyPhone(input: string): boolean {
  const s = String(input || '').trim();
  if (!s) return false;
  // Allow +, spaces, dashes, parentheses; require 7+ digits overall
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 16;
}

export function isLikelyDate(input: string): boolean {
  const s = String(input || '').trim();
  if (!s) return false;
  // Accept ISO-like, dd/mm/yyyy, mm/dd/yyyy, dd-mm-yyyy
  const isoLike = /^\d{4}-\d{1,2}-\d{1,2}$/;
  const dmySlash = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  const dmyDash = /^\d{1,2}-\d{1,2}-\d{2,4}$/;
  if (isoLike.test(s) || dmySlash.test(s) || dmyDash.test(s)) return true;
  const ts = Date.parse(s);
  return Number.isFinite(ts);
}

export type ExpectedKind = 'name' | 'email' | 'phone' | 'date' | 'generic';

export function inferExpectedKind(labelOrType?: string): ExpectedKind {
  const s = (labelOrType || '').toLowerCase();
  if (!s) return 'generic';
  if (s.includes('email')) return 'email';
  if (s.includes('phone') || s.includes('cell') || s.includes('mobile')) return 'phone';
  if (s.includes('date') || s.includes('birth')) return 'date';
  if (s.includes('name') || s.includes('fullname') || s.includes('full name')) return 'name';
  return 'generic';
}

export function validateByKind(kind: ExpectedKind, input: string): boolean {
  switch (kind) {
    case 'email': return isLikelyEmail(input);
    case 'phone': return isLikelyPhone(input);
    case 'date': return isLikelyDate(input);
    case 'name': return isLikelyFullName(input);
    default: return String(input || '').trim().length > 0;
  }
}


