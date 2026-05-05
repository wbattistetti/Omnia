# BookFromAgenda — backend unico

**Server:** Express, porta **3100** in sviluppo. In produzione usare **HTTPS** dietro reverse proxy (stesso path).

## Endpoint pubblico

**POST** `/api/runtime/bookfromagenda`

- **Contratto unico — chiavi puntate** nel JSON radice: **`agenda.json`** (oggetto) **oppure** **`agenda.url`** + **`agenda.type`**.
- **`queryConstraints`** **opzionale**. Se assente o null → nessun vincolo: si restituiscono tutti gli slot liberi dell’agenda (equivalente a `queryConstraints: {}`). Se presente → il solver applica filtri (`horizon`, `mandatory`, `preferred`, ecc.). **`horizon`** per il filtro è opzionale: con **`agenda.json`** o feed **Omnia** (e dopo materializzazione **ICS / Google / Outlook**), se manca si usa **min/max** delle `days[].date` dell’agenda. Per **scaricare** un ICS (o simile) da URL servono ancora **`horizon.start` / `horizon.end`** (o `queryConstraints.horizon`) come finestra di fetch.
- Nessun **`grid`** / **`timezone`** come parametri HTTP pubblici; ICS usa default server interni.
- **OpenAPI:** `GET http://localhost:3100/api/runtime/bookfromagenda/openapi.json` (v **4.3**).
- **Alias:** `POST …/bookfromagenda/solve`.

### Chiavi ufficiali (per integrazioni tipo Bolt)

**Radice (nomi di proprietà JSON, alcuni con punto letterale):**

| Chiave | Contenuto |
|--------|-----------|
| `agenda.json` | Oggetto UniversalAgenda o giorno compatto. Escluso con `agenda.url`. |
| `agenda.url` | Stringa URI del feed. Con `agenda.type`. |
| `agenda.type` | `Omnia` \| `ICS` \| `Google` \| `Outlook` (con `agenda.url`). |
| `horizon.start` | Data `YYYY-MM-DD` (fetch URL / coerenza con finestra). |
| `horizon.end` | Data `YYYY-MM-DD`. |
| `queryConstraints` | Opzionale. Oggetto vincoli (tabella sotto); se omesso = tutti gli slot liberi. Alias runtime: `query`. |

**Oggetto `queryConstraints` (annidato, senza punti nel nome della chiave):**

| Chiave | Contenuto |
|--------|-----------|
| `horizon` | `{ "start", "end" }` date inclusivi (filtro; opzionale se si deriva dall’agenda). |
| `allowedIntervals` | Array di `{ "start", "end" }` orari `HH:mm`. |
| `forbiddenIntervals` | Array di `{ "start", "end" }` orari esclusi. |
| `weekdays` | Array interi 0–6 (0=domenica … 6=sabato). Vuoto = tutti i giorni. |
| `preferredIntervals` | Preferenze soft (ordinamento). |
| `matchSlotDurationMinutes` | Filtra solo slot liberi con durata esatta (minuti). |
| `mandatory` / `preferred` | Forme esplicite alternative (subset solver); preferire i campi sopra per allineamento OpenAPI. |

**Solo dentro `agenda.json` (UniversalAgenda):** `timezone`, `days[]`, per ogni giorno `date`, `slots[]`, per ogni slot `time`, `duration`, `status` (`free` \| `booked`), ecc. — non sono chiavi puntate HTTP.

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
| Filtro | Opzionale `queryConstraints` (omit = nessun filtro); horizon esplicito o derivato da min/max `days[].date` quando ammesso |

Il **`timezone`** può esistere **dentro** il payload `agenda.json` (dato agenda), non come campo sibling HTTP dedicato alla materializzazione.

---

## Esempio senza horizon (derivato da agenda)

Puoi omettere `queryConstraints` del tutto oppure passare `{}`.

```json
{
  "agenda.json": {
    "days": [
      {
        "date": "2026-05-04",
        "slots": [{ "time": "09:00", "duration": 60, "status": "free" }]
      }
    ]
  }
}
```

La finestra di filtro diventa `2026-05-04` … `2026-05-04`.

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
