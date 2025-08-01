SPECIFICHE FUNZIONALI COMPLETE SIDEBAR (MODERNA, ENTERPRISE, DETTAGLIATA, CON COLORI E ICONE)
A. LAYOUT E STRUTTURA
SidebarContainer
Altezza: 100% viewport.
Larghezza: resizable (min 320px, max 600px).
Resize: handle visibile a destra (almeno 8px), cursore col-resize, drag fluido.
Sfondo: bg-slate-800 o colore tema scuro.
Bordo destro: border-r border-slate-700.
Scroll: verticale per il contenuto, mai per header o icone grandi.
SidebarHeader
Titolo progetto: testo grande, opzionalmente editabile.
Icone grandi (sempre visibili, in alto):
MacroTask: <Layers className="w-7 h-7 text-violet-700" /> su sfondo bg-violet-100, bordo border-violet-300.
Task: <CheckSquare className="w-7 h-7 text-blue-700" /> su sfondo bg-blue-100, bordo border-blue-300.
Nodo: <Square className="w-7 h-7 text-gray-700" /> su sfondo bg-gray-100, bordo border-gray-300.
(Aggiungi qui altre icone se richiesto, con palette coerente)
Search bar: sempre sotto le icone, con:
Icona lente: <Search className="absolute left-3 ... text-gray-400" />
Input: bg-white, border-gray-300, rounded-lg, testo nero, placeholder grigio.
Collapse/Expand: pulsante con <ChevronLeft /> o <ChevronRight /> a destra, sempre visibile.
B. SEZIONI/ACCORDION
Accordion generico
Header:
Icona entità (colorata, coerente con palette):
Agent Acts: <Bot className="w-5 h-5 text-purple-400" />
User Acts: <User className="w-5 h-5 text-green-400" />
Backend Actions: <Database className="w-5 h-5 text-blue-400" />
Conditions: <GitBranch className="w-5 h-5 text-yellow-400" />
Tasks: <CheckSquare className="w-5 h-5 text-orange-400" />
Macrotasks: <Layers className="w-5 h-5 text-red-400" />
DDT: <Puzzle className="w-5 h-5 text-fuchsia-400" />
Titolo: testo grande, colore coerente con icona.
Chevron: <ChevronLeft /> o <ChevronRight /> ruotato, sempre visibile, colore grigio.
Pulsante “+”: <Plus className="w-5 h-5" />, colore coerente con entità.
Solo un accordion aperto alla volta (gestione centralizzata).
DDT Accordion
Lista DDT:
Ogni riga:
Icona: coerente con tipo (es: <Calendar /> per date, <Mail /> per email, <MapPin /> per address, <FileText /> default).
Label: testo viola (#a21caf), font bold.
Matita: <svg ... stroke=\"#a21caf\" ... /> per edit inline.
Ingranaggio: <Settings /> per aprire/chiudere response editor/pane (non wizard!).
Cestino: <Trash2 className=\"w-5 h-5 text-fuchsia-700 hover:text-red-600\" />.
Conferma cancellazione: box inline sotto la riga, con pulsanti “Elimina” (rosso) e “Annulla” (grigio).
Wizard/modal DDT: sempre montato (invisible tabs), spinner su salvataggio (<Loader className=\"w-5 h-5 animate-spin\" /> su icona save).
Salvataggio: chiamata endpoint /api/factory/dialogue-templates (POST), spinner visibile su icona save.
Altri Accordion (Agent Acts, ecc.)
Categorie:
Header: label, matita (edit), cestino (delete), spunta/X (conferma/annulla edit), pulsante “+” per aggiungere voce.
Colori: label e icone coerenti con entità.
Lista voci (items):
Ogni voce: label, matita (edit), cestino (delete), spunta/X (conferma/annulla edit).
Aggiunta categoria: pulsante “+” nell’header dell’accordion.
Aggiunta voce: pulsante “+” nella riga categoria (textbox inline su prima riga).
Editing: textbox inline, icone coerenti, nessun overlay modale.
Conferma cancellazione: box inline sotto la categoria/voce, con “Elimina” (rosso) e “Annulla” (grigio).
C. MODALI/WIZARD
BuilderModal:
Sempre montato, mai smontato (invisible tabs).
Contiene tutti i wizard (DDTBuilder, AgentActBuilder, ecc.).
Solo uno visibile alla volta (display: none per gli altri).
Nessun key che causa remount.
Ogni wizard:
Tutti gli hook in cima, nessun early return.
Stato gestito internamente.
Chiusura via callback.
Spinner/feedback su operazioni lunghe.
D. STATO (CENTRALIZZATO, REACT useState/useReducer)
Accordion aperto (stringa: solo uno aperto).
Builder/modal attivo (stringa/null).
Editing label (id categoria/voce in editing).
Conferma cancellazione (id categoria/voce in conferma).
Search term.
Sidebar width/font size.
Spinner salvataggio.
E. UX
Spinner: su salvataggio DDT, visibile sull’icona save.
Conferma cancellazione: box elegante, inline, con “Elimina” (rosso) e “Annulla” (grigio).
Nessun alert modale: tutto inline, UX moderna.
Transizioni: apertura/chiusura accordion animate.
Focus: input in editing sempre autofocus.
Accessibilità: aria-label, tabIndex, focus visibile.
Colori: palette coerente, nessun colore “random”, tutto documentato.
F. PULIZIA
Nessuna variabile/import inutilizzato.
Tutto tipizzato (TypeScript).
Nessun warning linter.
Componenti piccoli, riutilizzabili, testabili.
Nessuna logica duplicata.
GARANZIE DI LAYOUT E UX
Le icone grandi sono sempre visibili in alto, mai nascoste.
La search bar è sempre sotto le icone, mai sparisce.
Ogni accordion ha header coerente, chevron sempre visibile, solo uno aperto.
Le liste sono sempre scrollabili, non spariscono mai.
I wizard/modal non causano mai errori di hook, sono sempre montati.
Nessun overlay modale blocca la sidebar: tutto è inline o in modale non bloccante.
Ogni micro-interazione (edit, add, delete, conferma) è gestita inline, senza alert browser.
Colori e icone sono sempre coerenti con la palette e la semantica dell’entità.
