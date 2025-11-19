# ✅ Checklist per testare la compilazione regex Date nella UX

## Prerequisiti completati

- [x] Contract Date rigenerato con placeholder `${MONTHS_PLACEHOLDER}`
- [x] Costanti mesi nel DB con struttura `values` array unificato
- [x] Endpoint `/api/constants/months/:language` implementato in `server.js`
- [x] `cloneAndAdaptContract` compila la regex quando crea l'istanza
- [x] Nessun fallback - tutto obbligatorio

## Verifiche da fare

### 1. Verifica endpoint backend
```bash
# Testa l'endpoint direttamente
curl http://localhost:3100/api/constants/months/IT
curl http://localhost:3100/api/constants/months/PT
curl http://localhost:3100/api/constants/months/EN
```

**Risultato atteso:**
```json
{
  "_id": "...",
  "locale": "IT",
  "values": ["gennaio", "febbraio", "aprile", "dic", "dic.", ...],
  "mapping": {...}
}
```

### 2. Verifica proxy Vite
Il frontend chiama `/api/constants/months/:language` che deve essere proxyato a Express (porta 3100).

**Verifica `vite.config.ts`:**
- Se `/api` va a FastAPI (8000), potrebbe servire un proxy specifico
- Oppure aggiungere `/api/constants` al proxy di Express

### 3. Test nella UX

#### Step 1: Apri un progetto
- Assicurati che `localStorage.getItem('project.lang')` sia impostato (IT, PT, o EN)

#### Step 2: Crea un'istanza Date
- Vai al Response Editor
- Crea un nuovo DDT o modifica uno esistente
- Aggiungi un nodo di tipo "Date" (dal template Date)

#### Step 3: Verifica nei log del browser
Apri la console e cerca:
```
🔍 [contractUtils] Compiling regex for date contract
✅ [contractUtils] Pattern mesi caricato
✅ [contractUtils] Regex compilata per istanza
```

#### Step 4: Verifica la regex compilata
Nel contract dell'istanza, la regex NON deve contenere `${MONTHS_PLACEHOLDER}` ma i mesi reali:
```javascript
// ❌ NON deve essere così:
"(?<month>0?[1-9]|1[0-2]|${MONTHS_PLACEHOLDER})"

// ✅ Deve essere così (esempio per IT):
"(?<month>0?[1-9]|1[0-2]|(gennaio|febbraio|marzo|aprile|...))"
```

#### Step 5: Test estrazione
- Apri il simulatore chat
- Inserisci una data: "12 aprile 1980" o "12 abril 1980"
- Verifica che estragga correttamente:
  - `day: 12`
  - `month: aprile` (o `abril` per PT)
  - `year: 1980`

## Problemi possibili

### Problema 1: Endpoint non raggiungibile
**Sintomo:** Errore `Failed to load months constants for language IT: HTTP 404`

**Soluzione:**
- Verifica che `server.js` sia in esecuzione su porta 3100
- Verifica il proxy in `vite.config.ts`
- Aggiungi proxy specifico se necessario:
```typescript
'/api/constants': { target: 'http://localhost:3100', changeOrigin: true }
```

### Problema 2: Costanti non trovate
**Sintomo:** Errore `No months found for language: IT`

**Soluzione:**
- Verifica che le costanti siano nel DB:
```bash
node -e "const {MongoClient}=require('mongodb');(async()=>{const c=await new MongoClient('mongodb+srv://...').connect();const r=await c.db('factory').collection('Constants').findOne({type:'months',locale:'IT'});console.log(JSON.stringify(r,null,2));await c.close();})()"
```

### Problema 3: Regex non compilata
**Sintomo:** La regex contiene ancora `${MONTHS_PLACEHOLDER}`

**Soluzione:**
- Verifica che `projectLanguage` sia passato a `cloneAndAdaptContract`
- Verifica che `localStorage.getItem('project.lang')` sia impostato
- Controlla i log della console per errori

## Comandi utili

### Verifica contract Date nel DB
```bash
node -e "const {MongoClient}=require('mongodb');(async()=>{const c=await new MongoClient('mongodb+srv://walterbattistetti:omnia@omnia-db.a5j05mj.mongodb.net/?retryWrites=true&w=majority&appName=Omnia-db').connect();const r=await c.db('factory').collection('Task_Templates').findOne({name:'date'});console.log('Has contract:',!!r.nlpContract);console.log('Regex:',r.nlpContract?.regex?.patterns?.[0]?.substring(0,100));console.log('Has placeholder:',r.nlpContract?.regex?.patterns?.[0]?.includes('\${MONTHS_PLACEHOLDER}'));await c.close();})()"
```

### Test endpoint manualmente
```bash
# IT
curl http://localhost:3100/api/constants/months/IT

# PT
curl http://localhost:3100/api/constants/months/PT

# EN
curl http://localhost:3100/api/constants/months/EN
```



