# Backend di prova per Omnia

Cartella riservata a **piccoli server HTTP di test** (OpenAPI/Swagger) quando servono mock dedicati.

Il mock **`booking-slots`** (porta 3110) è stato **rimosso**.

Per dipendenze Node usare la root del monorepo (`npm install`).

Per aggiungere un nuovo mock: nuova sottocartella con `server.js` + `openapi.json`, porta non in conflitto con Express (3100), FastAPI (8000), ApiServer VB.NET (5000). Aggiungere uno script npm e documentare l’URL qui.
