# ✅ Riepilogo: Cosa manca per testare nella UX

## ✅ Completato

1. **Contract Date rigenerato** con placeholder `${MONTHS_PLACEHOLDER}`
2. **Endpoint backend** `/api/constants/months/:language` implementato
3. **Proxy Vite** aggiornato per `/api/constants` → Express (3100)
4. **Compilazione regex** implementata in `cloneAndAdaptContract`
5. **Nessun fallback** - tutto obbligatorio

## 🎯 Per testare nella UX

### 1. Riavvia il dev server (se necessario)
Il proxy Vite richiede un riavvio per applicare le modifiche:
```bash
# Nel terminale frontend
npm run dev
```

### 2. Verifica che il backend Express sia in esecuzione
```bash
# Nel terminale backend
node server.js
# Dovrebbe essere su porta 3100
```

### 3. Test rapido endpoint
Apri il browser e vai a:
```
http://localhost:5173/api/constants/months/IT
```
Dovresti vedere JSON con i mesi italiani.

### 4. Test completo nella UX

#### Step 1: Imposta lingua progetto
Apri la console del browser e verifica:
```javascript
localStorage.getItem('project.lang')
// Dovrebbe essere 'IT', 'PT', o 'EN'
```

Se non c'è, imposta:
```javascript
localStorage.setItem('project.lang', 'IT')
```

#### Step 2: Crea istanza Date
1. Apri un progetto
2. Vai al Response Editor
3. Crea/modifica un DDT
4. Aggiungi un nodo "Date" (dal template)

#### Step 3: Verifica nei log
Apri la console del browser e cerca:
```
🔍 [contractUtils] Compiling regex for date contract
✅ [contractUtils] Pattern mesi caricato
✅ [contractUtils] Regex compilata per istanza
```

#### Step 4: Verifica regex compilata
Nel contract dell'istanza (puoi loggarlo), la regex NON deve contenere `${MONTHS_PLACEHOLDER}`:
```javascript
// ❌ SBAGLIATO:
"(?<month>0?[1-9]|1[0-2]|${MONTHS_PLACEHOLDER})"

// ✅ CORRETTO (esempio IT):
"(?<month>0?[1-9]|1[0-2]|(gennaio|febbraio|marzo|aprile|...))"
```

#### Step 5: Test estrazione
1. Apri il simulatore chat
2. Inserisci: "12 aprile 1980" (IT) o "12 abril 1980" (PT)
3. Verifica estrazione:
   - `day: 12`
   - `month: aprile` (o `abril` per PT)
   - `year: 1980`

## 🔍 Debug

### Se l'endpoint non funziona
1. Verifica che Express sia su porta 3100
2. Testa direttamente: `curl http://localhost:3100/api/constants/months/IT`
3. Verifica il proxy Vite (riavvia dev server)

### Se la regex non viene compilata
1. Verifica `localStorage.getItem('project.lang')` è impostato
2. Controlla i log della console per errori
3. Verifica che `projectLanguage` sia passato a `cloneAndAdaptContract`

### Se l'estrazione non funziona
1. Verifica che la regex sia compilata (non contiene placeholder)
2. Controlla i log di `contractExtractor.ts`
3. Verifica che i mesi nel DB siano corretti

## 📝 Note

- Il contract Date nel DB ha la regex template con placeholder
- La compilazione avviene SOLO quando si crea l'istanza
- Ogni istanza ha la sua regex compilata per la lingua del progetto
- Nessun fallback: se manca qualcosa, lancia errore esplicito



