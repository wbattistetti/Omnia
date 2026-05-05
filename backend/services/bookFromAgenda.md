# BookFromAgenda — backend unico

**Server:** Express, porta **3100** in sviluppo. In produzione usare **HTTPS** dietro reverse proxy (stesso path).

## Endpoint pubblico

**POST** `/api/runtime/bookfromagenda`

- **Contratto unico — chiavi puntate** nel JSON radice: **`agenda.json`** (oggetto) **oppure** **`agenda.url`** + **`agenda.type`**.
- Opzionale **`horizon.start`** / **`horizon.end`** (fetch URL); **`queryConstraints`** obbligatorio (include di norma `horizon` per il filtro).
- Nessun **`grid`** / **`timezone`** come parametri HTTP pubblici; ICS usa default server interni.
- **OpenAPI:** `GET http://localhost:3100/api/runtime/bookfromagenda/openapi.json` (v **4.1**).
- **Alias:** `POST …/bookfromagenda/solve`.

### Risposta

```json
{
  "slots": [
    { "date": "2026-05-04", "start": "09:00", "end": "10:00", "duration": 60 }
  ],
  "summary": {
    "dayCount": 1,
    "slotCount": 1
  }
}
```

---

## Esempi body (solo puntato)

**Agenda già strutturata (`agenda.json`):**

```json
{
  "agenda.json": {
    "timezone": "Europe/Rome",
    "days": [
      {
        "date": "2026-05-04",
        "slots": [{ "time": "09:00", "duration": 60, "status": "free" }]
      }
    ]
  },
  "queryConstraints": {
    "horizon": { "start": "2026-05-01", "end": "2026-05-31" },
    "weekdays": [1, 2, 3, 4, 5]
  }
}
```

**Fetch calendario (`agenda.url` + tipo + horizon puntato):**

```json
{
  "agenda.type": "ICS",
  "agenda.url": "https://example.com/calendar.ics",
  "horizon.start": "2026-05-01",
  "horizon.end": "2026-05-07",
  "queryConstraints": {
    "horizon": { "start": "2026-05-01", "end": "2026-05-31" }
  }
}
```

Non usare oggetto radice `agenda`, né proprietà top-level `agendaJson` — una sola convenzione: **puntato**.

---

## Pipeline

| Fase | Contenuto |
|------|-----------|
| Sorgente | `agenda.json` oppure `agenda.url` + `agenda.type` |
| Normalizzazione | Omnia / JSON → UA; ICS-like → UA con default interni |
| Filtro | `queryConstraints` |

Il **`timezone`** può esistere **dentro** il payload `agenda.json` (dato agenda), non come campo sibling HTTP dedicato alla materializzazione.

---

## Sicurezza URL

Solo **https** (eccezione **http** verso `localhost` / `127.0.0.1`); SSRF; limite dimensione risposta.

---

## Moduli

- `bookFromAgendaService.js` — `solveBookFromAgenda`
- `bookFromAgendaInput.js` — sorgenti, `INTERNAL_ICS_GRID`
- `bookFromAgendaIcs.js`
- `schedulingConstraintSolver.js`

**Altro:** `POST /api/runtime/scheduling/solve` — solver sintetico senza agenda esterna.
