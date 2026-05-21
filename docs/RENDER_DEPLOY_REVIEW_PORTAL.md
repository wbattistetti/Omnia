# Deploy portale review su Render

## 1. Push su GitHub

Assicurati che su `wbattistetti/Omnia` ci siano `render.yaml`, `railway.json` (opzionale), fix `server.js`, cartella `use-case-review-portal/`.

```powershell
cd "C:\Cursor Projects\Omnia"
git add render.yaml package.json backend/server.js use-case-review-portal docs/RENDER_DEPLOY_REVIEW_PORTAL.md
git commit -m "Render: deploy review portal + Express"
git push origin main
```

(Se le modifiche sono solo su `demo-flow`, pusha quel branch e in Render imposta **Branch** = `demo-flow`.)

## 2. Account Render

1. https://render.com → Sign up → **GitHub** → autorizza **wbattistetti**
2. Seleziona repo **Omnia**

## 3. Crea il Web Service

**New +** → **Web Service** → repo **wbattistetti/Omnia**

| Campo | Valore |
|--------|--------|
| **Name** | `omnia-review` (o come preferisci) |
| **Region** | Frankfurt (EU) se disponibile |
| **Branch** | `main` o `demo-flow` |
| **Root Directory** | *(vuoto)* |
| **Runtime** | Node |
| **Build Command** | `npm run render:build` |
| **Start Command** | `node backend/server.js` |
| **Plan** | Free |

Oppure: **New +** → **Blueprint** → collega repo (usa `render.yaml` automaticamente).

## 4. Variabili d'ambiente (Environment)

| Key | Valore |
|-----|--------|
| `OMNIA_WRITABLE_CONFIG` | `1` |
| `AGENT_REVIEW_CHANNEL_TOKEN` | password segreta (es. `review2026`) |
| `VITE_AGENT_REVIEW_CHANNEL_TOKEN` | **stesso valore** della riga sopra (serve alla build Vite) |
| `NODE_VERSION` | `22` *(opzionale, Render spesso lo imposta)* |

Senza token, le API review restano aperte (solo per test).

## 5. Deploy

Clicca **Create Web Service**. Attendi build (5–15 min la prima volta).

URL pubblico (esempio):
`https://omnia-review.onrender.com/review-portal`

## 6. Piano Free

- Il servizio **si addormenta** dopo inattività; la prima richiesta può richiedere ~30–60 s.
- Per review occasionali va bene.

## 7. Test locale (prima del cloud)

```powershell
npm run review-portal:build
npm run be:express
```

Apri http://localhost:3100/review-portal
