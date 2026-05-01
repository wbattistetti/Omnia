# Backend di prova per Omnia

Cartella **solo per test**: piccoli server HTTP con **OpenAPI/Swagger** servito da URL, come un backend di produzione. Omnia scarica lo spec dall’URL (proxy `/api/openapi-proxy` o fetch diretto) e usa la Read API sui campi documentati.

## Requisiti

Dipendenze Node nella cartella `backend/`:

```bash
cd backend && npm install
```

## Servizi disponibili

| Cartella        | Script npm                              | Porta default | Descrizione breve        |
|-----------------|-----------------------------------------|----------------|--------------------------|
| `booking-slots` | `npm run be:mock-testing:booking-slots` (anche avviato da `npm run dev:beNew`) | 3110 | Slot appuntamenti casuali |

Variabile d’ambiente `PORT` per cambiare la porta (aggiorna anche `servers` in `openapi.json` se usi un’altra porta, oppure incolla in Omnia l’URL reale che usi).

## Omnia: URL da incollare

- **Read API / documento OpenAPI:** `http://localhost:3110/openapi.json` (o `/swagger.json`)
- **Chiamata effettiva (GET):** `http://localhost:3110/slots?startDate=2026-05-02&N=12&P=3`

Comportamento identico a un API reale: stesso flusso Backend Call e mapping SEND/RECEIVE dai nomi nello spec.

## Aggiungere un altro mock

1. Nuova sottocartella con `server.js` + `openapi.json`.
2. Porta diversa da 3100 (Express principale) e dagli altri mock.
3. Aggiungere uno script in `package.json` alla root del monorepo.
