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

/**
 * Genera N slot da startDate, al massimo P per giorno; ore casuali in [startHour, endHour).
 * @param {string|Date} startDate
 * @param {number} N
 * @param {number} P
 * @param {number} startHour
 * @param {number} endHour escluso (nessuna ora sorteggiata >= endHour)
 */
function generateSlots(startDate, N, P, startHour, endHour) {
  const slots = [];
  const base = new Date(startDate);
  if (Number.isNaN(base.getTime())) {
    throw new Error('startDate non valida');
  }
  if (endHour <= startHour) {
    throw new Error('endHour deve essere maggiore di startHour');
  }

  let remaining = N;
  let dayOffset = 0;
  while (remaining > 0) {
    const countToday = Math.min(P, remaining);
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + dayOffset);

    for (let i = 0; i < countToday; i++) {
      const hour =
        Math.floor(Math.random() * (endHour - startHour)) + startHour;
      const minute = Math.floor(Math.random() * 60);
      const slot = new Date(day);
      slot.setUTCHours(hour, minute, 0, 0);
      slots.push({
        start: slot.toISOString(),
        end: new Date(slot.getTime() + 30 * 60 * 1000).toISOString(),
      });
    }
    remaining -= countToday;
    dayOffset += 1;
  }
  return slots;
}

/**
 * @param {unknown} v
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number | null}
 */
function parseIntQuery(v, fallback, min, max) {
  if (v === undefined || v === '') return fallback;
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
  const startRaw =
    typeof req.query.startDate === 'string' && req.query.startDate.trim()
      ? req.query.startDate.trim()
      : new Date().toISOString().slice(0, 10);

  const N = parseIntQuery(req.query.N, 10, 1, 200);
  const P = parseIntQuery(req.query.P, 3, 1, 50);
  const startHour = parseIntQuery(req.query.startHour, 9, 0, 23);
  const endHour = parseIntQuery(req.query.endHour, 18, 1, 24);

  if (N === null || P === null || startHour === null || endHour === null) {
    return res.status(400).json({
      error:
        'Parametri numerici fuori range o non validi (N 1–200, P 1–50, startHour 0–23, endHour 1–24).',
    });
  }

  try {
    const slots = generateSlots(startRaw, N, P, startHour, endHour);
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
  console.log(`[booking-slots mock] http://localhost:${PORT}`);
  console.log(`[booking-slots mock] OpenAPI: http://localhost:${PORT}/openapi.json`);
  console.log(
    `[booking-slots mock] Esempio: http://localhost:${PORT}/slots?startDate=2026-05-02&N=12&P=3`
  );
});
