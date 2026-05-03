/**
 * Mock HTTP + OpenAPI per test in Omnia (Backend Call + Read API).
 * Dipendenze: usa `express` e `cors` da `backend/node_modules` (npm install nella cartella backend).
 *
 * Avvio da root repo: npm run be:mock-testing:booking-slots
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const PORT = Number.parseInt(process.env.PORT || '3110', 10);
const SPEC_PATH = path.join(__dirname, 'openapi.json');

function loadOpenApiDoc() {
  const raw = fs.readFileSync(SPEC_PATH, 'utf8');
  return JSON.parse(raw);
}

function utcIsoDateString(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveStartDateLiteral(raw) {
  if (raw === undefined || raw === null) return { ok: false, error: 'startDate mancante.' };
  const t = String(raw).trim();
  if (!t) return { ok: false, error: 'startDate mancante.' };
  if (/^Now$/i.test(t)) {
    return { ok: true, isoDate: utcIsoDateString(new Date()) };
  }
  if (/^Tomorrow$/i.test(t)) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return { ok: true, isoDate: utcIsoDateString(d) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const parsed = new Date(`${t}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'startDate ISO non valida.' };
    }
    return { ok: true, isoDate: t };
  }
  return {
    ok: false,
    error: 'startDate: usa YYYY-MM-DD oppure Now o Tomorrow.',
  };
}

/**
 * Per ogni giorno nell’intervallo [0, days), genera fino a slotsPerDay slot; ore casuali in [startHour, endHour).
 */
function generateSlots(isoStartDate, days, slotsPerDay, startHour, endHour) {
  const slots = [];
  const base = new Date(`${isoStartDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    throw new Error('startDate non valida');
  }
  if (endHour <= startHour) {
    throw new Error('endHour deve essere maggiore di startHour');
  }
  if (days < 1 || slotsPerDay < 1) {
    throw new Error('days e slotsPerDay devono essere ≥ 1');
  }

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + dayOffset);

    for (let i = 0; i < slotsPerDay; i++) {
      const hour = Math.floor(Math.random() * (endHour - startHour)) + startHour;
      const minute = Math.floor(Math.random() * 60);
      const slot = new Date(day);
      slot.setUTCHours(hour, minute, 0, 0);
      slots.push({
        start: slot.toISOString(),
        end: new Date(slot.getTime() + 30 * 60 * 1000).toISOString(),
      });
    }
  }
  return slots;
}

/**
 * @param {unknown} v
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function parseRequiredInt(v, min, max) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const openApiDoc = loadOpenApiDoc();

function serveSpec(_req, res) {
  res.type('application/json').send(openApiDoc);
}

app.get('/openapi.json', serveSpec);
app.get('/swagger.json', serveSpec);

app.get('/slots', (req, res) => {
  const sdRes = resolveStartDateLiteral(req.query.startDate);
  if (!sdRes.ok) {
    return res.status(400).json({ error: sdRes.error });
  }

  const days = parseRequiredInt(req.query.days, 1, 60);
  const slotsPerDay = parseRequiredInt(req.query.slotsPerDay, 1, 50);
  const startHour = parseRequiredInt(req.query.startHour, 0, 23);
  const endHour = parseRequiredInt(req.query.endHour, 1, 24);

  if (days === null || slotsPerDay === null || startHour === null || endHour === null) {
    return res.status(400).json({
      error:
        'Parametri obbligatori: days (1–60), slotsPerDay (1–50), startHour (0–23), endHour (1–24). Nessun default implicito.',
    });
  }

  try {
    const slots = generateSlots(sdRes.isoDate, days, slotsPerDay, startHour, endHour);
    return res.json({ slots });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(400).json({ error: msg });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'booking-slots', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[booking-slots] listening on http://localhost:${PORT}`);
});
