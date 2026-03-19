# Analisi Toolbar – Progetto Omnia

## Stato attuale

- **Header**: mostra "Progetto: [nome]" e opzionalmente "(owner= ...)" e "Cliente: [nome]" in modo frammentato.
- **Pulsanti**: Chiudi progetto (a sinistra), Salva Progetto e Deployment (al centro), Backend (React/VB.NET), Ingranaggio impostazioni, Esegui (a destra).
- **Problemi**: layout poco ordinato, manca versione in header, nessun "Apri progetto" né "Salva come".

---

## 1. Header – Informazioni progetto

**Obiettivo**: una sola riga chiara e standard.

**Formato proposto**:
```text
Progetto: [nome] v [versione]  -  Cliente: [nome]
```

- **Nome**: già presente (`currentProject.name`).
- **Versione**: usare `currentProject.version` (es. "1.0") e opzionalmente `versionQualifier` (alpha/beta/rc/production) → es. "1.0" o "1.0-beta". Se assente: "–" o "1.0".
- **Cliente**: `currentProject.clientName`; se assente: "–" o "N/D".

Rimuovere dalla barra la dicitura "(owner= ...)" per non appesantire; eventualmente lasciarla solo in impostazioni/dettaglio progetto.

---

## 2. Pulsanti – Raggruppamento e stile

**Obiettivo**: raggruppamento logico e aspetto uniforme (stesso stile, icona + etichetta, altezza uguale).

**Gruppo 1 – Progetto (a sinistra, dopo l’header)**  
| Azione         | Comportamento                          |
|----------------|----------------------------------------|
| Apri progetto  | Nuovo: torna alla landing per scegliere un progetto. |
| Chiudi progetto| Chiude il progetto e torna alla home.  |
| Salva progetto | Salvataggio normale.                   |
| Salva come     | Nuovo: apre dialog per nome/versione e salva come copia o nuova versione. |

**Gruppo 2 – Deployment (stesso blocco o separato da un divisore sottile)**  
| Azione    | Comportamento              |
|-----------|----------------------------|
| Deployment| Apre il dialog di deploy.  |

**Stile suggerito**:
- Pulsanti secondari (Apri, Chiudi): `bg-slate-700 hover:bg-slate-600`, icona + testo.
- Salva: già evidenziato (es. viola).
- Salva come: stile “secondario” ma riconoscibile (es. bordo viola o testo viola).
- Deployment: blu come ora.
- Altezza e padding uniformi; eventuale `gap` fisso tra i pulsanti.

---

## 3. Backend (React / VB.NET)

**Considerazione**: è un selettore di ambiente/runtime, utile soprattutto in sviluppo. Può essere considerato “legacy” o avanzato.

**Opzioni**:
- **A**: Spostarlo nel menu **Impostazioni** (ingranaggio), come due voci o un sottomenu “Backend”.
- **B**: Lasciarlo in barra ma in forma compatta (es. pill con “React” o “VB.NET” e icona, senza etichetta “Backend:”).
- **C**: Lasciarlo com’è ma in una zona meno in vista (es. dopo Deployment, prima di Impostazioni).

**Suggerimento**: A (menu Impostazioni) per una toolbar più pulita; in alternativa B se deve restare sempre visibile.

---

## 4. Ingranaggio (Impostazioni)

- **Posizione**: a destra, prima di “Esegui”, coerente con “azioni globali”.
- Se Backend viene spostato qui, il menu con Provider/Model, Font, **e** Backend diventa il punto unico per “configurazione”.

---

## 5. Esegui

- **Posizione**: mantiene la posizione di **azione primaria** a destra (verde, play).
- **Visibilità**: solo se ci sono nodi nel flowchart (come ora).
- Non raggrupparlo con Deployment in un unico “menu”; restano due azioni distinte (Esegui = run, Deployment = deploy).

---

## 6. Salva come

**Obiettivo**: permettere di cambiare nome e/o versione e salvare (copia o nuova versione).

**Flusso suggerito**:
1. Pulsante "Salva come" in toolbar.
2. Click → apre un dialog con:
   - Nome progetto (editabile, precompilato con il nome attuale).
   - Versione (es. "1.0") e qualificatore (alpha/beta/rc/production).
   - Cliente (opzionale, editabile).
3. Azioni: "Annulla" e "Salva come".
4. "Salva come" → callback `onSaveAs({ name, version, versionQualifier, clientName })`:
   - **Opzione A**: crea un nuovo progetto (copia) con i nuovi metadati e apre quello.
   - **Opzione B**: aggiorna nome/versione del progetto corrente e salva (stesso ID, nuova versione in catalogo).

Implementazione iniziale: dialog + callback; la logica lato backend (copia vs aggiornamento versione) può essere aggiunta in seguito.

---

## Riepilogo modifiche

| Area        | Modifica |
|------------|----------|
| Header     | "Progetto: [nome] v [versione] - Cliente: [nome]" con fallback per campi mancanti. |
| Tipi       | Aggiungere `version?` e `versionQualifier?` a `ProjectData` dove serve. |
| Pulsanti   | Aggiungere Apri progetto e Salva come; raggruppare e uniformare stile (Apri, Chiudi, Salva, Salva come, Deployment). |
| Backend    | Spostare in Impostazioni (o lasciare compatto in barra). |
| Impostazioni | Tenere a destra prima di Esegui; eventualmente includere Backend. |
| Esegui     | Invariato, sempre come CTA principale a destra. |
| Salva come | Nuovo pulsante + dialog nome/versione/cliente + callback `onSaveAs`. |

---

## Ordine visivo suggerito (da sinistra a destra)

1. **Home** (icona).
2. **Header** (Progetto: … v … - Cliente: …).
3. **Gruppo Progetto**: [ Apri progetto | Chiudi progetto | Salva progetto | Salva come ].
4. **Deployment** (con eventuale separatore).
5. **Backend** (se resta in barra: pill React/VB.NET; altrimenti solo in Impostazioni).
6. **Impostazioni** (ingranaggio).
7. **Esegui** (verde, play).

File da toccare: `src/components/Toolbar.tsx`, `src/types/project.ts` (opzionale per version), `src/components/AppContent.tsx` (onOpenProject, onSaveAs), eventuale nuovo componente `SaveAsDialog.tsx`.
