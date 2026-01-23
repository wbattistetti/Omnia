# Report Analisi Task DataRequest in dBFactory

## Data Analisi
**Data**: 2024-12-19
**Database**: factory
**Collection**: Tasks
**Tipo analizzato**: type: 3 (DataRequest)

---

## 📊 Summary

| Categoria | Count | Percentuale |
|-----------|-------|-------------|
| **Totale task DataRequest** | 53 | 100% |
| **Con mainData** | 3 | 5.7% |
| **Senza mainData** | 50 | 94.3% |
| **Con subDataIds** | 28 | 52.8% |
| **Con subDataIds ma senza mainData** | 27 | 50.9% |
| **Date con sub-data mancanti** | 1 | 1.9% |
| **Compositi senza struttura** | 8 | 15.1% |
| **SubDataIds invalidi** | ~20 | ~37.7% |

---

## 🔍 Analisi Dettagliata

### 1️⃣ Task CON mainData (3 task)

I task con mainData sono tutti **task atomici** (senza sub-data):

1. **Email Address** (`ff225459-e377-43a5-a00e-f8cb8b4dd191`)
   - Type: `email`
   - SubData: 0 ✅ (corretto per tipo atomico)

2. **Phone Number** (`5802ec29-10f3-40c8-86e1-96683f533ff5`)
   - Type: `phone`
   - SubData: 0 ✅ (corretto per tipo atomico)

3. **Number** (`18e8c5ee-e035-40a9-b7e3-f35608b29661`)
   - Type: `number`
   - SubData: 0 ✅ (corretto per tipo atomico)

**Conclusione**: I task con mainData sono corretti e completi.

---

### 2️⃣ Task SENZA mainData (50 task)

Questi task **NON hanno mainData** che indica il tipo di dato da raccogliere. Sono task atomici che dovrebbero essere referenziati come sub-data da task compositi.

**Esempi trovati**:
- `Day` (879ad4a5-dc07-4ee0-809a-e37acb0cb91f)
- `Month` (f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f)
- `Year` (3f7c43bf-23c5-4328-bb71-938cd8ea7ad7)
- `First name` (06ee20f6-28a0-49bc-9a09-27a680b2421a)
- `Last name` (a2f9a212-1ceb-4448-a857-c4cb6229be73)
- `Country code`, `Street`, `Civic number`, `Postal code`, `City`, ecc.

**Caratteristiche comuni**:
- ✅ Hanno `steps` (root level)
- ❌ NON hanno `mainData`
- ❌ NON hanno `dialogueSteps`
- ❌ NON hanno `nlpContract`

---

## 📋 Tabella Riassuntiva Problemi

| # | Problema | Count | Gravità | Priorità |
|---|----------|-------|---------|----------|
| 1 | Task atomici senza mainData | 50 | Media | Alta |
| 2 | Task con subDataIds invalidi ("atomic", "generic") | ~20 | **Critica** | **Critica** |
| 3 | Task compositi con subDataIds ma senza mainData | 27 | Media | Alta |
| 4 | Task Date con sub-data incompleti | 1 | **Critica** | **Critica** |
| 5 | Task compositi con subDataIds inesistenti | 3+ | Alta | Alta |
| 6 | Task che dovrebbero essere compositi ma senza struttura | 8 | Bassa | Media |

---

## ⚠️ Problemi Identificati

### Problema 1: Task atomici senza mainData
**Situazione**: 50 task atomici (Day, Month, Year, First name, ecc.) sono di tipo `DataRequest` ma **non hanno mainData**.

**Impatto**:
- Questi task non indicano chiaramente il tipo di dato che devono raccogliere
- Non è possibile distinguere se un task è atomico o composito dalla struttura

**Soluzione proposta**:
- Aggiungere `mainData` anche ai task atomici con un singolo nodo che indica il tipo di dato
- Esempio per `Day`: `mainData: [{ id: "...", label: "Day", type: "number", ... }]`

---

### Problema 2: Task date con sub-data incompleti ⚠️ **CRITICO**

**Situazione**: Trovati **2 task "Date"** che NON hanno mainData e hanno problemi con i sub-data:

#### Task Date 1 (`e37700b9-a437-4337-993f-79073614dbd6`) - **PROBLEMA GRAVE**
- ❌ **NON ha mainData**
- ❌ **Ha solo 1 subDataId** invece di 3 (giorno, mese, anno)
- ❌ **Il subDataId è la stringa "atomic"** invece di un ID di task reale
- ✅ Ha steps (6 keys)

**Questo è esattamente il problema descritto**: un task di tipo datarequest che deve riconoscere date ma ha solo un subdato invece di tre.

#### Task Date 2 (`723a1aa9-a904-4b55-82f3-a501dfbe0351`)
- ❌ **NON ha mainData**
- ⚠️ **Ha 3 subDataIds** ma i task referenziati **non esistono** nel database
- ✅ Ha steps (6 keys)

**Impatto**:
- I task date non possono funzionare correttamente perché:
  1. Non hanno mainData che indica il tipo di dato (date)
  2. Non hanno tutti i sub-data necessari (giorno, mese, anno)
  3. I subDataIds referenziano task inesistenti o valori invalidi

**Soluzione proposta**:
1. **Per Task Date 1**:
   - Aggiungere mainData con tipo "date"
   - Sostituire subDataIds con i 3 task atomici esistenti (Day, Month, Year):
     - `879ad4a5-dc07-4ee0-809a-e37acb0cb91f` (Day)
     - `f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f` (Month)
     - `3f7c43bf-23c5-4328-bb71-938cd8ea7ad7` (Year)

2. **Per Task Date 2**:
   - Aggiungere mainData con tipo "date"
   - Verificare e correggere i subDataIds con i task atomici corretti

3. **Struttura corretta attesa**:
   ```json
   {
     "type": 3,
     "label": "Date",
     "mainData": [{
       "id": "...",
       "label": "Date",
       "type": "date",
       "subData": [
         { "id": "879ad4a5-dc07-4ee0-809a-e37acb0cb91f" }, // Day
         { "id": "f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f" }, // Month
         { "id": "3f7c43bf-23c5-4328-bb71-938cd8ea7ad7" }  // Year
       ]
     }]
   }
   ```

---

## 📋 Dettaglio Task Problematici

### Task "Date" con Problema Critico

| Campo | Valore |
|-------|--------|
| **ID** | `e37700b9-a437-4337-993f-79073614dbd6` |
| **Label** | Date |
| **Type** | 3 (DataRequest) |
| **TemplateId** | null |
| **MainData** | ❌ Assente |
| **SubDataIds** | 1 (dovrebbero essere 3) |
| **SubDataIds[0]** | `"atomic"` ❌ (invalido - dovrebbe essere ID task) |
| **Steps** | ✅ Presente (6 keys) |
| **DialogueSteps** | ❌ Assente |
| **NlpContract** | ❌ Assente |

**Problema**: Questo task dovrebbe raccogliere una data completa (giorno + mese + anno) ma:
- Non ha mainData che indica il tipo "date"
- Ha solo 1 subDataId invece di 3
- Il subDataId è la stringa "atomic" invece di un ID di task reale

**Task atomici disponibili per correzione**:
- Day: `879ad4a5-dc07-4ee0-809a-e37acb0cb91f`
- Month: `f4dc80fd-3d3b-424c-9f05-0fe1e4130e1f`
- Year: `3f7c43bf-23c5-4328-bb71-938cd8ea7ad7`

---

### Task "Date" con SubDataIds Inesistenti

| Campo | Valore |
|-------|--------|
| **ID** | `723a1aa9-a904-4b55-82f3-a501dfbe0351` |
| **Label** | Date |
| **Type** | 3 (DataRequest) |
| **TemplateId** | null |
| **MainData** | ❌ Assente |
| **SubDataIds** | 3 (corretto) |
| **SubDataIds[0]** | `691708f082f0c8d95d05b706` ❌ (task non trovato) |
| **SubDataIds[1]** | `691708f082f0c8d95d05b707` ❌ (task non trovato) |
| **SubDataIds[2]** | `691708f082f0c8d95d05b708` ❌ (task non trovato) |
| **Steps** | ✅ Presente (6 keys) |

**Problema**: Questo task ha 3 subDataIds (corretto) ma i task referenziati non esistono nel database (probabilmente ID obsoleti o da migrazione).

---

## 💡 Raccomandazioni

### Priorità Critica 🔴

1. **Correggere task con subDataIds invalidi**
   - Rimuovere o correggere subDataIds con valori "atomic" e "generic"
   - Se il task è atomico: rimuovere subDataIds e aggiungere mainData
   - Se il task è composito: sostituire con ID reali dei task atomici

2. **Correggere task Date incompleti**
   - Task Date 1: Sostituire subDataId "atomic" con 3 ID reali (Day, Month, Year)
   - Task Date 2: Sostituire subDataIds inesistenti con ID reali
   - Aggiungere mainData con tipo "date" a entrambi

### Priorità Alta 🟠

3. **Correggere task compositi con subDataIds inesistenti**
   - Full Name: Verificare e correggere subDataIds (First name, Last name)
   - Address: Verificare e correggere subDataIds (Street, Civic, Postal, City, ecc.)
   - Trovare o creare i task atomici mancanti

4. **Aggiungere mainData ai task compositi esistenti**
   - 27 task hanno subDataIds validi ma mancano mainData
   - Aggiungere mainData che indica il tipo di dato composito

5. **Aggiungere mainData ai task atomici**
   - Ogni task atomico dovrebbe avere un `mainData` con un singolo nodo che indica il tipo di dato
   - Questo rende la struttura coerente e permette di identificare il tipo di dato

### Priorità Media 🟡

3. **Verificare task atomici esistenti**
   - Assicurarsi che tutti i task atomici (Day, Month, Year, First name, Last name, ecc.) siano corretti e completi
   - Verificare che abbiano `steps` e `nlpContract` se necessario

4. **Documentare struttura attesa**
   - Documentare la struttura corretta per task atomici vs compositi
   - Definire quando usare mainData con subData vs mainData senza subData

---

## 📝 Note Tecniche

### Struttura Attesa

**Task Atomico** (es. Day, Month, First name):
```json
{
  "type": 3,
  "label": "Day",
  "mainData": [{
    "id": "...",
    "label": "Day",
    "type": "number",
    "constraints": [...],
    "nlpContract": {...}
  }]
}
```

**Task Composito** (es. Date of Birth):
```json
{
  "type": 3,
  "label": "Date of Birth",
  "mainData": [{
    "id": "...",
    "label": "Date of Birth",
    "type": "date",
    "subData": [
      { "id": "day-task-id" },
      { "id": "month-task-id" },
      { "id": "year-task-id" }
    ]
  }]
}
```

---

## ⚠️ Problemi Aggiuntivi Trovati

### Problema 3: Task con subDataIds invalidi ⚠️ **CRITICO**

**Situazione**: Trovati **~20 task** con `subDataIds` che contengono valori invalidi invece di ID di task reali:

- **Stringa "atomic"**: 15+ task hanno `subDataIds: ["atomic"]` invece di ID reali
- **Stringa "generic"**: 5 task hanno `subDataIds: ["generic"]` invece di ID reali
- **ID inesistenti**: Molti task referenziano ID che non esistono nel database

**Esempi di task con "atomic"**:
- `Full name` (144b648a-5dd7-4ef2-baf3-0f73c55af5c8)
- `Email address` (1d936daf-7767-4c63-992a-30a48b24aa0d)
- `Phone number` (ca7a50a3-0da9-4840-bce6-0f2718d1af25)
- `Address` (cbf65b28-2d25-447d-8a29-3755ae3bca43)
- `Tax code`, `IBAN`, `VAT number`, `POD/PDR code`, ecc.

**Esempi di task con "generic"**:
- `Backend Call` (f3aab7da-6496-4eb4-9909-cfea54a3a5cc)
- `AI Agent` (64fb985e-2067-49c0-b31b-0a2fddd1a9a6)
- `Negotiation` (554a17cb-85b6-4a85-9383-55e44a072bb7)
- `Summary` (a36bfbf7-0126-4f36-bb83-6e0096e826ab)
- `Message` (654412d5-381e-43e3-b780-4d26e85ce37e)

**Impatto**: Questi task non possono funzionare correttamente perché i subDataIds non referenziano task reali.

---

### Problema 4: Task compositi con subDataIds inesistenti

**Situazione**: Trovati task compositi che referenziano task inesistenti:

1. **Full Name** (`a5e95f32-a895-41c9-a3b7-c8cadf8c091f`)
   - Ha 2 subDataIds ma i task referenziati non esistono
   - Dovrebbe referenziare First name e Last name

2. **Address** (`cbf65b28-2d25-447d-8a29-3755ae3bca43`)
   - Ha 8 subDataIds ma tutti i task referenziati non esistono
   - Dovrebbe referenziare Street, Civic number, Postal code, City, ecc.

3. **Date** (`723a1aa9-a904-4b55-82f3-a501dfbe0351`)
   - Ha 3 subDataIds ma i task referenziati non esistono
   - Dovrebbe referenziare Day, Month, Year

**Impatto**: Questi task compositi non possono funzionare perché i sub-data referenziati non esistono.

---

### Problema 5: Task che dovrebbero essere compositi ma non hanno struttura

**Situazione**: Trovati **8 task** con label che suggeriscono dati composti ma non hanno né mainData né subDataIds:

**Task Address** (dovrebbero avere sub-data: street, civic, postal, city):
- `Street` (4ab3e717-ab7a-43b1-8b17-44b4f4918c12)
- `Postal code` (326e9f6a-a30c-4369-b614-ad873f026962) - già atomico, OK
- `City` (acea9860-f77e-43af-89e1-bf324928553b) - già atomico, OK
- `Street Name` (3c4b63d7-740b-4fc1-bd66-54754734c448)
- `Street Number` (0e5b824d-a855-4dbb-bba4-b99d07483707)
- `Email address` (25d5e841-b228-4401-9f79-fcd18893e52f)
- `Postal code` (b14bfb41-87fb-4b6b-a5c1-02f31029b6ce)
- `Personal Data` (2a254f5c-7afc-466f-9427-866466dfc632)

**Impatto**: Questi task potrebbero essere atomici (corretti) o compositi mancanti (da verificare).

---

### Problema 6: Task compositi corretti ma senza mainData

**Situazione**: Trovati task compositi che hanno subDataIds validi ma **non hanno mainData**:

1. **Street Information** (`886df1f2-f1f9-4d14-a23c-619756d88391`)
   - ✅ Ha 2 subDataIds validi
   - ❌ NON ha mainData

2. **Location Details** (`de032fc8-3396-43e4-8385-ae7031099d54`)
   - ✅ Ha 2 subDataIds validi
   - ❌ NON ha mainData

3. **Contact Information** (`47668225-605b-4d5c-a108-1c0f5e228b8d`)
   - ✅ Ha 2 subDataIds validi (Email, Phone)
   - ❌ NON ha mainData

4. **Identity Information** (`c3de71e5-b84e-4951-893b-28f0545492c7`)
   - ✅ Ha 2 subDataIds validi
   - ❌ NON ha mainData

**Impatto**: Questi task funzionano ma mancano della struttura mainData che indica il tipo di dato composito.

---

## ✅ Conclusioni

1. **50 task atomici** (94.3%) mancano di `mainData` - **da correggere**
2. **27 task con subDataIds** ma senza mainData - **da correggere**
3. **~20 task con subDataIds invalidi** ("atomic", "generic") - **PROBLEMA CRITICO**
4. **2 task "Date" trovati** con problemi critici:
   - Task 1: Ha solo 1 subDataId ("atomic") invece di 3 - **PROBLEMA GRAVE**
   - Task 2: Ha 3 subDataIds ma referenziano task inesistenti
5. **Task compositi con subDataIds inesistenti**: Full Name, Address, Date
6. **8 task che dovrebbero essere compositi** ma non hanno struttura
7. **3 task con mainData** sono corretti (Email, Phone, Number)

**Struttura attuale**:
- Task atomici (Day, Month, Year) esistono ma non hanno mainData
- Task date/compositi esistono ma sono malformati (mancano mainData, subDataIds invalidi, referenze inesistenti)
- Molti task hanno subDataIds con valori placeholder ("atomic", "generic") invece di ID reali

**Prossimi passi**: Creare script di migrazione per:
1. **PRIORITÀ CRITICA**: Correggere task con subDataIds invalidi ("atomic", "generic"):
   - Rimuovere subDataIds invalidi o sostituirli con ID reali
   - Se il task è atomico, rimuovere subDataIds e aggiungere mainData
2. **PRIORITÀ ALTA**: Correggere i 2 task "Date" esistenti:
   - Aggiungere mainData con tipo "date"
   - Correggere subDataIds con i 3 task atomici corretti (Day, Month, Year)
3. **PRIORITÀ ALTA**: Correggere task compositi con subDataIds inesistenti:
   - Trovare o creare i task atomici mancanti
   - Aggiornare i subDataIds con ID validi
4. Aggiungere mainData ai 50 task atomici
5. Aggiungere mainData ai 27 task compositi che hanno subDataIds ma non mainData
6. Verificare che tutti i sub-data siano task atomici corretti in dBFactory

---

## 📝 Elenco Completo Task Problematici

### Task con subDataIds = "atomic" (da correggere)

| ID | Label | Tipo Atteso |
|----|-------|-------------|
| `e37700b9-a437-4337-993f-79073614dbd6` | Date | Composito (3 sub-data) |
| `144b648a-5dd7-4ef2-baf3-0f73c55af5c8` | Full name | Composito (2 sub-data) |
| `1d936daf-7767-4c63-992a-30a48b24aa0d` | Email address | Atomico |
| `ca7a50a3-0da9-4840-bce6-0f2718d1af25` | Phone number | Atomico |
| `86847458-5421-4cf3-9399-5ede7bb85935` | Tax code | Atomico |
| `40b6d98f-026e-43e3-b554-7b512c5bbdf9` | IBAN | Atomico |
| `b717775f-338d-4ccc-b8b7-e5ca6abccea6` | VAT number | Atomico |
| `c5ec3dcb-685a-44cd-bf06-54de337e9c80` | POD/PDR code | Atomico |
| `b09794a3-591b-4ebd-a703-5015cc6c2827` | Account number | Atomico |
| `0edca06a-6e2d-4fe2-a87b-b13493b09ab1` | Amount | Atomico |
| `d2dc964f-e73b-4de4-8877-e6ccca74365d` | Postal code | Atomico |
| `e7b08ada-cceb-4a0c-814f-28a8e814ce2c` | Time | Atomico |
| `7e505674-6490-4294-87c1-f0bfdb6009fe` | Website URL | Atomico |
| `2932b35b-094e-4f5f-bbb5-be587c9620f2` | Text field | Atomico |
| `fbc6788c-8f5b-4aea-ade4-8adf5d69c421` | Complex Address | Composito |

### Task con subDataIds = "generic" (da correggere)

| ID | Label | Tipo Atteso |
|----|-------|-------------|
| `f3aab7da-6496-4eb4-9909-cfea54a3a5cc` | Backend Call | Non DataRequest |
| `64fb985e-2067-49c0-b31b-0a2fddd1a9a6` | AI Agent | Non DataRequest |
| `554a17cb-85b6-4a85-9383-55e44a072bb7` | Negotiation | Non DataRequest |
| `a36bfbf7-0126-4f36-bb83-6e0096e826ab` | Summary | Non DataRequest |
| `654412d5-381e-43e3-b780-4d26e85ce37e` | Message | Non DataRequest |

### Task compositi con subDataIds inesistenti

| ID | Label | SubDataIds Count | Problema |
|----|-------|------------------|----------|
| `a5e95f32-a895-41c9-a3b7-c8cadf8c091f` | Full Name | 2 | ID inesistenti |
| `cbf65b28-2d25-447d-8a29-3755ae3bca43` | Address | 8 | ID inesistenti |
| `723a1aa9-a904-4b55-82f3-a501dfbe0351` | Date | 3 | ID inesistenti |

### Task compositi corretti ma senza mainData

| ID | Label | SubDataIds Count | Status |
|----|-------|------------------|--------|
| `886df1f2-f1f9-4d14-a23c-619756d88391` | Street Information | 2 | ✅ Valid, ❌ No mainData |
| `de032fc8-3396-43e4-8385-ae7031099d54` | Location Details | 2 | ✅ Valid, ❌ No mainData |
| `47668225-605b-4d5c-a108-1c0f5e228b8d` | Contact Information | 2 | ✅ Valid, ❌ No mainData |
| `c3de71e5-b84e-4951-893b-28f0545492c7` | Identity Information | 2 | ✅ Valid, ❌ No mainData |
