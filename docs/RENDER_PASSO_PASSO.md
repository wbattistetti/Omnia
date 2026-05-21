# Render — passo passo (Omnia review portal)

URL servizio: **https://omnia-nvl1.onrender.com**  
Portale: **https://omnia-nvl1.onrender.com/review-portal/**

## 1. Apri il servizio

https://dashboard.render.com → clicca **Omnia** (Web Service).

## 2. Imposta branch e comandi

Menu sinistro → **Settings** → scorri **Build & Deploy**:

| Campo | Copia-incolla esatto |
|--------|----------------------|
| **Branch** | `demo-flow` |
| **Build Command** | `npm install && npm run render:build` |
| **Start Command** | `node backend/server.js` |

Clicca **Save Changes** in fondo.

## 3. Variabili (Environment)

Menu **Environment** → Add:

- `OMNIA_WRITABLE_CONFIG` = `1`
- `AGENT_REVIEW_CHANNEL_TOKEN` = una password (es. `review2026`)
- `VITE_AGENT_REVIEW_CHANNEL_TOKEN` = **stessa password**

Save.

## 4. Nuovo deploy (obbligatorio dopo il fix)

Menu **Deploys** → in alto a destra **Manual Deploy** → **Deploy latest commit**.

Deve comparire commit **`fix(Render): add portal deps`** o hash `2a7557fa` (o più recente).

**Non** guardare il deploy fallito delle 16:15 — è vecchio.

## 5. Build riuscita — cosa vedi nei log

Cerca queste righe (build nuova):

- `added 15x packages` nel portale (non solo 139)
- `✓ 2000+ modules transformed` (non solo 22)
- `✓ built in ...`
- Stato deploy: **Live** (verde)

## 6. Prova nel browser

- https://omnia-nvl1.onrender.com/api/ping
- https://omnia-nvl1.onrender.com/review-portal/

Prima apertura (piano Free): può impiegare ~30–60 secondi.
