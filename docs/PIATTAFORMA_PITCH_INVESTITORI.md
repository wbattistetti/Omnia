# Omnia — Pitch per investitori

Documento **non finanziario**: non contiene metriche di revenue o trazione; va completato dal team con dati reali prima di condivisioni formali.

---

## One-liner

**Omnia è la piattaforma per progettare e far girare dialoghi aziendali “governati”: grafo di task compilato, motori di riconoscimento eterogenei e vincoli espliciti — non un generico chatbot basato solo su prompt.**

---

## Il problema

Le imprese stanno spendendo in **LLM e voice** per automazione del servizio, vendita e processi. Il limite ricorrente è la **mancanza di controllo**: risposte imprevedibili, difficoltà a dimostrare **conformità** (settori regolati), costi di manutenzione di prompt fragili, e divario tra “demo in chat” e **produzione voce** stabile. I builder conversazionali classici offrono flussi visivi ma spesso restano **superficiali** rispetto a compilazione, test di regressione e semantica delle variabili su percorsi complessi.

---

## La soluzione

Omnia unisce **modellazione esplicita** (TaskTree, flowchart, subflow con binding documentati), **compilazione** verso strutture eseguibili, **Dialogue Engine** con stato, escalation e limiti, **Grammar Flow** su grafo per linguaggio controllato, e **pipeline di generazione** a più layer (contratti, vincoli, motori, test, messaggi). Dove serve l’LLM, interviene in modo **delimitato** (es. estrazione verso un IR, poi **compilazione deterministica** senza raffinamento opaco dell’IR da parte del modello), riducendo deriva e aumentando **auditabilità**. L’integrazione con **stack vocali** (es. ElevenLabs / ConvAI) collega il progetto conversazionale al canale reale, non come semplice wrapper ASR+LLM+TTS.

**Delega agli agenti esterni:** i passi dedicati agli **agenti IA** (modelli multi-provider o ConvAI) vivono **dentro il grafo**: il motore decide quando entrare e uscire; il comportamento stocastico resta **confinato** al singolo task tramite regole compilate e contratti di risposta — così si combinano **libertà del modello** dove serve e **controllo di processo** dove il business lo richiede. Approfondimento tecnico: `PIATTAFORMA_IA_DELEGATION_GOVERNED.md`.

---

## Differenziale innovativo (rispetto ad altre piattaforme)

Questo è il cuore del posizionamento: non “abbiamo l’IA”, ma **architettura del dialogo**.

| Dimensione | Piattaforme tipiche | Omnia |
|------------|---------------------|--------|
| **Natura del controllo** | Intent + prompt + tool; molto è **emergente** | **Modello dichiarativo** (task, condizioni, variabili con identità stabile, subflow) adatto a percorsi obbligati e policy |
| **Ruolo dell’LLM** | Spesso unico motore del comportamento | **LLM come assistente** (estrazione, classificazione dove ha senso), non come unica fonte di verità; **IR + compile** per ripetibilità |
| **Input utente** | Classificazione intent o estrazione generica | **Motori multipli** (regex, NER, euristiche, LLM) + **grammar graph** per frasi strutturate |
| **Qualità nel tempo** | Regressione difficile da governare | Pipeline con **contratti**, **test generati**, use case / regressioni conversazionali integrate nel ciclo di progettazione |
| **Voce** | Accoppiamento leggero a provider | **Mapping e provisioning** verso runtime vocali nel perimetro del prodotto |
| **Agenti / LLM esterni** | Spesso il dialogo intero è “un prompt” | **Task AI Agent** nel flusso deterministico; IA **delimitata** (contratto, stato, uscita verso il grafo) |

**In una frase per il memorandum:** Omnia investe in **ingegneria del dialogo compilata e testabile**, mentre molti competitor investono in **UX del prompt** — due risposte diverse allo stesso mercato, con trade-off diversi su **controllo, costo di manutenzione e rischio regolatorio**.

**Moat potenziale (onesto):** non è un brevetto su “chatbot”, ma **profondità del modello** (semantica task/variabili/subflow, compiler, engine, grammar), **switching cost** per chi ha portato processi critici su quel modello, e **qualità** derivante da test e pipeline strutturate. Il rischio è che giganti LLM aggiungano strumenti simili: il rischio mitigato è la **specializzazione verticale** e il **time-to-value** su dialoghi regolati e voce in produzione.

---

## Perché ora

L’adozione massiccia degli LLM ha reso **evidente** il bisogno di **affidabilità** e **spiegabilità** lato enterprise. Le organizzazioni cercano “AI” ma comprano **governance**. Omnia si posiziona su quel gap.

---

## Mercato (qualitativo)

- **Enterprise customer service**, onboarding guidato, raccolta dati strutturata, procedure interne, assistenti vocali in contesti regolati o ad alta litigiosità.
- **Buyer**: CIO/CTO, head of digital/customer experience, team prodotto voce; spesso in tandem con **compliance** e **IT security**.

*(Numeri di TAM/SAM/SOM e CAGR: da inserire solo con fonti verificate.)*

---

## Modello di business (ipotesi da validare)

Esempi classici: **SaaS** per team di progettazione, tier per progetti/produzione; **licenza enterprise** per ambienti dedicati, SLA e supporto; servizi professionali per onboarding complesso. Da definire con la strategia commerciale reale.

---

## Stadio e trazione — [da compilare]

- Fase del prodotto: [alpha / beta / GA].
- Clienti o piloti: [lista o anonimizzato].
- Metriche chiave: [ARR/MRR, pipeline, MAU designer, minuti voce, ecc.].

---

## Roadmap narrativa (non impegnativa)

Rafforzare integrazioni vocali e provider LLM, templates verticali, governance e osservabilità (log strutturati del dialogo), scalabilità operativa del backend.

---

## Round / uso dei fondi — [da compilare]

- Importo cercato: [ ].
- Uso principale: [prodotto, go-to-market, team, infrastruttura].

---

## Call to action

Per approfondimenti tecnici: `docs/PIATTAFORMA_OMNIA_SINTESI.md`. Per architettura della generazione: `docs/ARCHITECTURE.md`.

---

*Questo documento supporta la narrazione investitori; non sostituisce business plan, data room o consulenza legale/finanziaria.*
