const { MongoClient } = require('mongodb');
const http = require('http');

const DEFAULT_URI = process.env.OMNIA_MONGO_URI || 'mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db';
const DB_FACTORY = 'factory';

const cache = {
  extractors: new Map(), // key: `${kind}|${locale}` -> extractor doc
  bindings: new Map(), // not used yet beyond global
};

async function getDb() {
  const client = new MongoClient(DEFAULT_URI);
  await client.connect();
  return { client, db: client.db(DB_FACTORY) };
}

async function getExtractorFor(kind, locale = 'it') {
  const key = `${kind}|${locale}`;
  if (cache.extractors.has(key)) return cache.extractors.get(key);
  const { client, db } = await getDb();
  try {
    const bindings = db.collection('ExtractorBindings');
    const b = await bindings.findOne({ scope: 'global', targetId: '*', kind, locale });
    if (!b) return null;
    const extractors = db.collection('Extractors');
    const ex = await extractors.findOne({ _id: b.extractorId, active: true });
    if (ex) cache.extractors.set(key, ex);
    return ex;
  } finally {
    await client.close();
  }
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])([a-zà-ÿ]*)/gi, (_, a, b) => a.toUpperCase() + b);
}

function sanitizeAddress(rawAddr, rawText) {
  const out = { ...(rawAddr || {}) };
  const t = String(rawText || '');
  // city in street
  if (!out.city && typeof out.street === 'string') {
    const m = out.street.match(/^\s*(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]+?)(?:\s+in)?\s+(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
    if (m) {
      out.city = titleCase(m[1].trim());
      out.street = out.street.replace(m[0], m[2] + ' ').trim();
    }
  }
  if (!out.city) {
    // Prefer non-greedy capture of city and strip eventual trailing 'in'
    const m2 = t.match(/\b(?:ad|a|in)\s+([A-Za-zÀ-ÿ'\s]{3,}?)\s+(?:in\s+)?(via|viale|corso|piazza|vicolo|strada|piazzale)\b/i);
    if (m2) out.city = titleCase(m2[1].trim().replace(/\s+in$/i, ''));
  }
  // number from street
  if (!out.number && typeof out.street === 'string') {
    const mn = out.street.match(/\b(\d+[A-Za-z]?)\b$/);
    if (mn) { out.number = mn[1]; out.street = out.street.replace(/\s*\b\d+[A-Za-z]?\b\s*$/, '').trim(); }
  }
  // cap from street
  if (!out.postal_code && typeof out.street === 'string') {
    const mp = out.street.match(/\b(\d{5})\b/);
    if (mp) { out.postal_code = mp[1]; out.street = out.street.replace(/\b\d{5}\b/, '').trim(); }
  }
  // If street missing or wrongly recognized as 'cap', try to extract from full text
  if (!out.street || /^cap\b/i.test(String(out.street))) {
    const sm = t.match(/\b(via|viale|corso|piazza|vicolo|strada|piazzale)\s+([A-Za-zÀ-ÿ'\s]+?)(?:,|\s+\d+\b|$)/i);
    if (sm) {
      out.street = titleCase(`${sm[1]} ${sm[2].trim()}`);
      // try to get number just after street match
      const after = t.slice(sm.index + sm[0].length);
      const nn = after.match(/\b(\d+[A-Za-z]?)\b/);
      if (nn && !out.number) out.number = nn[1];
    }
  }
  // If postal code still missing, try from text
  if (!out.postal_code) {
    const capT = t.match(/\b(\d{5})\b/);
    if (capT) out.postal_code = capT[1];
  }
  if (typeof out.street === 'string') {
    let s = out.street.replace(/^\s*(?:ad|a|in)\s+/i, '').trim();
    if (out.city) {
      const c = String(out.city).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cityPrefix = new RegExp(`^\s*(?:${c})\s*(?:in\s+)?`, 'i');
      s = s.replace(cityPrefix, '');
    }
    out.street = titleCase(s.replace(/\s{2,}/g, ' ').trim());
  }
  if (typeof out.city === 'string') out.city = titleCase(out.city.replace(/\s+in$/i, ''));
  if (typeof out.state === 'string') out.state = titleCase(out.state);
  if (typeof out.country === 'string') out.country = titleCase(out.country);
  return out;
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runExtractor(kind, text, locale = 'it') {
  const ex = await getExtractorFor(kind, locale);
  if (!ex) return { ok: false, error: 'extractor_not_found' };
  const t = String(text || '');
  if (ex.engine === 'libpostal+rules') {
    try {
      const parsed = await postJson('http://127.0.0.1:8000/api/parse-address', { text: t });
      if (parsed && parsed.ok && parsed.address) {
        const addr = sanitizeAddress(parsed.address, t);
        return { ok: true, fields: addr, confidence: 0.9 };
      }
      return { ok: false, error: 'libpostal_failed' };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }
  if (ex.kind === 'email') {
    const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? { ok: true, fields: { email: m[0] }, confidence: 0.9 } : { ok: false };
  }
  if (ex.kind === 'phone') {
    const normalized = t.replace(/[\s\-]/g, '');
    const m = normalized.match(/\+?\d{8,}/);
    return m ? { ok: true, fields: { number: m[0] }, confidence: 0.8 } : { ok: false };
  }
  if (ex.kind === 'date') {
    const m1 = t.match(/(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (m1) return { ok: true, fields: { day: +m1[1], month: +m1[2], year: +m1[3] }, confidence: 0.8 };
    const m2 = t.match(/(\b\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\s+(\d{2,4})\b/);
    const MONTHS = { gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6, luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12 };
    if (m2 && MONTHS[m2[2].toLowerCase()]) return { ok: true, fields: { day: +m2[1], month: MONTHS[m2[2].toLowerCase()], year: +m2[3] }, confidence: 0.75 };
    return { ok: false };
  }
  if (ex.kind === 'name') {
    const m = t.match(/(?:mi\s+chiamo|nome\s+(?:e|è))\s+([A-Za-zÀ-ÿ'`-]+)\s+([A-Za-zÀ-ÿ'`-]+)/i);
    if (m) return { ok: true, fields: { firstname: m[1], lastname: m[2] }, confidence: 0.7 };
    return { ok: false };
  }
  if (ex.kind === 'number') {
    const m = t.match(/-?\d+(?:[\.,]\d+)?/);
    return m ? { ok: true, fields: { value: m[0].replace(',', '.') }, confidence: 0.6 } : { ok: false };
  }
  if (ex.kind === 'text') {
    return { ok: true, fields: { value: t.trim() }, confidence: 0.5 };
  }
  return { ok: false, error: 'engine_not_implemented' };
}

module.exports = { getExtractorFor, runExtractor };


