import type { Task, TaskTree, TaskTreeNode, MaterializedStep } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TaskType, templateIdToTaskType } from '../types/taskTypes';
import { StepType } from '../types/stepTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * CONCETTUAL FLOW: Task Instance Creation from Row Definition
 * ============================================================================
 *
 * Questo documento descrive il flusso completo di creazione di un task istanza
 * a partire dalla definizione di una riga nel flowchart con i suoi metadati.
 *
 * ============================================================================
 * FASE 1 — Creazione della riga e metadati
 * ============================================================================
 *
 * Step 1.1: L'utente crea una riga nel flowchart
 * - Testo: "Chiedi la data di nascita del paziente"
 * - La riga viene creata con un rowId univoco
 *
 * Step 1.2: Analisi euristica della riga
 * - Il sistema analizza il testo della riga
 * - Classifica il tipo di task (es. DataRequest)
 * - Cerca un template corrispondente tramite matching semantico
 * - Trova il template "Date" con templateId: "723a1aa9-a904-4b55-82f3-a501dfbe0351"
 * - Memorizza i metadati nella riga:
 *   * taskType: DataRequest
 *   * templateId: "723a1aa9-a904-4b55-82f3-a501dfbe0351"
 *   * inferredCategory: null (opzionale)
 *
 * Step 1.3: La riga è pronta
 * - La riga contiene i metadati necessari per creare il task
 * - Il task non esiste ancora (lazy creation)
 *
 * ============================================================================
 * FASE 2 — Click sull'ingranaggio (lazy task creation)
 * ============================================================================
 *
 * Step 2.1: L'utente clicca sull'ingranaggio
 * - Il sistema verifica se esiste già un task per questa riga
 *   * Se esiste → carica quello esistente (non ricrea)
 *   * Se non esiste → inizia la creazione lazy
 *
 * Step 2.2: Creazione del task base
 * - Normalizza la label subito:
 *   * Prende il testo della riga: "Chiedi la data di nascita del paziente"
 *   * Rimuove "Chiedi la" / "Chiedi il" / "Chiedi" all'inizio
 *   * Risultato: "data di nascita del paziente"
 * - Crea un task con:
 *   * id: rowId (stesso ID della riga)
 *   * type: DataRequest
 *   * templateId: "723a1aa9-a904-4b55-82f3-a501dfbe0351" (dai metadati)
 *   * label: "data di nascita del paziente" (già normalizzata)
 *   * steps: {} (vuoto, da popolare)
 *   * ❌ NON data: [] - non serve salvarlo (si ricostruisce runtime)
 *
 * ============================================================================
 * FASE 3 — Costruzione dell'albero dei dati (dereferenziazione)
 * ============================================================================
 *
 * Step 3.1: Caricamento del template principale
 * - Carica il template usando templateId: "723a1aa9-a904-4b55-82f3-a501dfbe0351"
 * - Il template "Date" è un template composito con subData
 *
 * Step 3.2: Costruzione dell'albero completo
 * - Chiama buildDataTree(template)
 * - Il template ha un dato principale con subData referenziati:
 *   * Main: { id: "723a1aa9-...", subData: [{ id: "879ad4a5-..." }, ...] }
 * - Per ogni subData referenziato:
 *   * Carica il template corrispondente (può essere atomico O composito)
 *   * Se composito → dereferenzia ricorsivamente anche i suoi subData
 *   * Supporta profondità arbitraria (ricorsione completa)
 *   * Costruisce il nodo completo con constraints, examples, nlpContract
 *   * Imposta templateId = ID del template referenziato
 *
 * IMPORTANTE - Terminologia:
 * - "Nodo principale" = nodo al primo livello dell'albero
 * - "Nodo annidato" = nodo in subData (qualsiasi profondità)
 * - Ogni nodo rappresenta un dato con id e templateId
 * - Non esiste più il concetto di "main node" o "root node"
 * - L'annidamento dipende da come sono annidati i template
 *
 * IMPORTANTE - Regole id vs templateId:
 * - Per template atomico/composito: id === templateId === template.id
 * - Per template aggregato: ogni dato ha id === templateId (del template referenziato),
 *   ma id !== template.id (del template aggregato)
 * - Per subData (sempre): id === templateId (del template atomico/composito referenziato)
 *
 * Step 3.3: Albero completo in memoria
 * - L'albero contiene:
 *   * Nodo principale "Date" con templateId: "723a1aa9-..."
 *   * Nodo annidato "Day" con templateId: "879ad4a5-..."
 *   * Nodo annidato "Month" con templateId: "f4dc80fd-..."
 *   * Nodo annidato "Year" con templateId: "3f7c43bf-..."
 * - Ogni nodo ha id e templateId corretti
 * - L'albero vive solo in memoria (non viene salvato)
 *
 * ============================================================================
 * FASE 4 — Adattamento dei prompt al contesto
 * ============================================================================
 *
 * Step 4.1: Estrazione dei prompt da adattare
 * - Di default: solo per i nodi principali (primo livello dell'albero)
 * - Opzionale: estendere ad altri nodi con flag esplicito (extendToChildren)
 * - Estrae i prompt dello step "start" (o "normal")
 * - Raccoglie tutti i prompt da adattare con i loro ID (per batch processing)
 *
 * IMPORTANTE - Contesto implicito:
 * - Il primo messaggio principale definisce il contesto esplicito
 *   Esempio: "Mi dica la data di nascita del paziente"
 * - I messaggi successivi (subData, escalation) usano contesto implicito
 *   Esempio subData "Day": "Che giorno?" (non serve "del paziente")
 *   Esempio subData "Month": "Che mese?" (non serve "del paziente")
 * - Se si chiede "mi dica i dati personali del paziente", poi:
 *   * "Nome e cognome?" (non serve "del paziente")
 *   * "Data di nascita?" (non serve "del paziente")
 * - Si può estendere il contesto ad altri nodi con flag esplicito
 *
 * Step 4.2: Adattamento AI (batch processing)
 * - Raccoglie TUTTI i prompt da adattare in un unico batch
 * - Chiama l'API /api/ddt/adapt-prompts con:
 *   * Array di prompt con ID: [{ promptId, nodeId, stepType, text }, ...]
 *   * Contesto: "data di nascita del paziente"
 *   * Task label: "data di nascita del paziente"
 * - L'AI adatta tutti i prompt in una singola chiamata (più efficiente)
 * - Esempio:
 *   * Originale: "Qual è la data?"
 *   * Adattato: "Qual è la data di nascita del paziente?"
 *
 * Step 4.3: Applicazione dei prompt adattati
 * - Per ogni prompt adattato ricevuto:
 *   * Trova il task di escalation corrispondente usando promptId
 *   * Sostituisci il testo del prompt con quello adattato
 * - I prompt adattati sono pronti per essere usati nella clonazione
 *
 * ============================================================================
 * FASE 5 — Clonazione degli steps
 * ============================================================================
 *
 * Step 5.1: Iterazione sull'albero
 * - Per ogni nodo nell'albero (nodi principali + nodi annidati ricorsivamente):
 *   * Prende node.templateId
 *   * Determina quale template contiene gli steps per questo nodo
 *
 * Step 5.2: Caricamento degli steps dal template
 * - Se node.templateId === template.id (template principale):
 *   * Prende steps da template.steps[node.templateId]
 * - Se node.templateId !== template.id (template atomico/composito referenziato):
 *   * Carica il template atomico/composito
 *   * Prende steps da atomicTemplate.steps[node.templateId]
 *
 * Step 5.3: Applicazione dei prompt adattati
 * - Per i nodi principali: sostituisce i prompt "start" con quelli adattati
 * - Per i nodi annidati: mantiene i prompt originali (o li adatta se esteso)
 *
 * Step 5.4: Clonazione con nuovi task IDs
 * - Per ogni step clonato:
 *   * Genera nuovi GUID per i task nelle escalation
 *   * Mantiene la struttura degli step
 *   * Crea un mapping oldGUID → newGUID per le traduzioni
 *
 * Step 5.5: Popolamento di task.steps
 * - Aggiunge gli steps clonati a task.steps[node.templateId]
 * - Struttura risultante:
 *   task.steps = {
 *     "723a1aa9-...": { start: [...], noMatch: [...], ... },  // Nodo principale
 *     "879ad4a5-...": { start: [...], noMatch: [...], ... },  // Nodo annidato "Day"
 *     "f4dc80fd-...": { start: [...], noMatch: [...], ... },  // Nodo annidato "Month"
 *     "3f7c43bf-...": { start: [...], noMatch: [...], ... }   // Nodo annidato "Year"
 *   }
 *
 * IMPORTANTE - Chiave di task.steps:
 * - Usa SEMPRE node.templateId come chiave (non node.id)
 * - Perché node.templateId identifica univocamente il template da cui vengono gli steps
 * - node.id potrebbe essere diverso (nel caso di template aggregato)
 *
 * ============================================================================
 * FASE 6 — Copia delle traduzioni
 * ============================================================================
 *
 * Step 6.1: Mapping GUID
 * - Usa il mapping oldGUID → newGUID creato durante la clonazione
 * - Per ogni GUID clonato, trova la traduzione originale nel template
 *
 * Step 6.2: Copia delle traduzioni
 * - Carica le traduzioni del template per i vecchi GUID
 * - Crea nuove traduzioni per i nuovi GUID con lo stesso testo
 * - Salva le traduzioni nel sistema di traduzioni del progetto
 *
 * ============================================================================
 * FASE 7 — Salvataggio del task istanza
 * ============================================================================
 *
 * Step 7.1: Preparazione dei dati da salvare
 * - Prepara l'oggetto da salvare:
 *   {
 *     templateId: "723a1aa9-a904-4b55-82f3-a501dfbe0351",  // ✅ Per ricostruire tutto
 *     label: "data di nascita del paziente",                // ✅ Specializzata (già normalizzata)
 *     steps: { ... },                                        // ✅ Steps clonati e adattati
 *     // ❌ NON data: [] - non serve! (si ricostruisce runtime)
 *     // ❌ NON constraints, examples, nlpContract - vengono dal template (a meno di override)
 *   }
 *
 * Step 7.2: Salvataggio nel repository
 * - Salva il task nel TaskRepository
 * - Il task è ora persistito con:
 *   * templateId per ricostruire l'albero
 *   * steps clonati e adattati
 *   * label specializzata
 *
 * ============================================================================
 * FASE 8 — Apertura del ResponseEditor
 * ============================================================================
 *
 * Step 8.1: Caricamento del task
 * - Carica il task dal repository usando rowId
 *
 * Step 8.2: Ricostruzione dell'albero
 * - Prende task.templateId
 * - Chiama buildTaskTreeNodes(template) → ricostruisce l'albero in memoria
 * - L'albero è identico a quello costruito in FASE 3
 *
 * Step 8.3: Caricamento degli steps
 * - Prende task.steps (già clonati e adattati)
 * - Per ogni nodo nell'albero:
 *   * Trova gli steps usando task.steps[node.templateId]
 *   * Mostra gli steps nel ResponseEditor
 *
 * Step 8.4: Visualizzazione nella sidebar
 * - Mostra l'albero nella sidebar (nodi principali + nodi annidati)
 * - Quando l'utente seleziona un nodo:
 *   * Mostra gli steps da task.steps[node.templateId]
 *   * Mostra constraints/examples/nlpContract dal nodo dell'albero (dal template)
 *
 * ============================================================================
 * PRINCIPI FONDAMENTALI
 * ============================================================================
 *
 * 1. L'albero dereferenziato vive solo in memoria
 *    - Costruito runtime con buildTaskTreeNodes(template)
 *    - Usato per sidebar e clonazione steps
 *    - NON viene salvato in task.data
 *
 * 2. Nel task istanza si salva solo:
 *    - templateId (per ricostruire tutto)
 *    - steps (clonati e adattati)
 *    - label (specializzata e normalizzata)
 *    - Override opzionali: constraints, examples, nlpContract (solo se modificati)
 *
 * 3. Ogni nodo ha id e templateId
 *    - id = identificatore del nodo
 *    - templateId = ID del template da cui viene il dato
 *    - Regola: id === templateId (sempre)
 *    - Eccezione: per template aggregato, id !== template.id (ma id === templateId del referenziato)
 *
 * 4. task.steps usa templateId come chiave
 *    - task.steps[node.templateId] = steps clonati
 *    - NON usare node.id come chiave
 *
 * 5. Il sistema è deterministico
 *    - Con templateId puoi ricostruire tutto runtime
 *    - Non serve salvare l'albero
 *    - Non serve salvare constraints/examples (vengono dal template)
 *
 * ============================================================================
 */

/**
 * Load DDT from template (reference) and instance (steps + overrides)
 *
 * This function loads the DDT structure for the editor by combining:
 * - Template structure (data, constraints, examples, nlpContract) - source of truth
 * - Instance overrides (steps with cloned task IDs, modified constraints/examples)
 *
 * Rules:
 * - label, steps: Always from instance (always editable)
 * - data structure: From template (reference), but allows instance additions
 * - constraints, examples, nlpContract: ALWAYS from template (reference) - NO overrides allowed
 *
 * Structure:
 * - Nodes with templateId !== null: Structure from template, steps cloned with new task IDs, contracts from template
 * - Nodes with templateId === null: Complete structure from instance (added nodes)
 */

/**
 * Carica template dal progetto (non dalla Factory)
 * I template del progetto sono salvati nella collection 'tasks' del database del progetto
 */
export async function loadTemplateFromProject(templateId: string, projectId: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
    if (!response.ok) return null;

    const data = await response.json();
    // ✅ L'endpoint restituisce { count: number, items: Task[] }
    const tasks = Array.isArray(data) ? data : (data.items || []);

    if (!Array.isArray(tasks)) {
      return null;
    }

    // ✅ Template ha templateId === null (sono template, non istanze)
    const template = tasks.find((t: any) => t.id === templateId && t.templateId === null);
    return template || null;
  } catch (error) {
    return null;
  }
}

/**
 * Assicura che esista un template per il task nel progetto.
 * Se templateId è null, crea automaticamente un nuovo template nel progetto.
 *
 * IMPORTANTE:
 * - Template creati automaticamente vengono salvati nel progetto, non nella Factory
 * - La Factory contiene solo concetti universali
 * - Template del progetto sono specifici del flusso
 *
 * @param instance - Task instance (può avere templateId === null)
 * @param taskTree - TaskTree opzionale (se disponibile, usa la struttura)
 * @param projectId - Project ID (obbligatorio per salvare nel progetto)
 * @returns Template creato o esistente
 */
export async function ensureTemplateExists(
  instance: Task,
  taskTree: TaskTree | undefined,
  projectId: string
): Promise<any> {
  // Se ha già templateId, restituisci il template esistente
  if (instance.templateId && instance.templateId !== 'UNDEFINED') {
    // ✅ NO FALLBACK: Template must be in memory cache
    const existing = DialogueTaskService.getTemplate(instance.templateId);
    if (existing) return existing;

    // ✅ NO FALLBACK: If not in cache, template doesn't exist
    throw new Error(`Template ${instance.templateId} not found in memory cache. Templates must be in memory - no fallback to database.`);
  }

  // ✅ Crea nuovo template nel progetto
  const newTemplateId = uuidv4();

  // Costruisci struttura template da taskTree o da instance (legacy)
  // ✅ IMPORTANTE: Local Template NON deve avere campi Factory (dataContract, valueSchema, subTasksIds)
  // Il backend classifica come Factory Template se ha questi campi, e rifiuta di salvarli nel progetto
  const templateData: any = {
    id: newTemplateId,
    type: instance.type || TaskType.UtteranceInterpretation,
    templateId: null,  // ✅ Template ha sempre templateId === null
    label: instance.label || taskTree?.label || 'New Template',
    icon: 'FileText',
    steps: {},  // Steps vuoti nel template (saranno clonati nelle istanze)
    // ❌ RIMOSSO: subTasksIds, dataContract, valueSchema (campi Factory che causano classificazione errata)
    // ❌ RIMOSSO: constraints (campo Factory)
    // ❌ RIMOSSO: introduction (non necessario per Local Template)
    // ❌ NON salvare: data (usa subTasksIds solo se necessario, ma non qui)
  };

  // ✅ Salva template nel progetto usando /api/projects/:pid/tasks
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create template in project: ${response.status} ${errorText}`);
  }

  const saved = await response.json();

  return saved;
}

// ❌ RIMOSSO: buildDDTFromTask - Usa buildTaskTree invece

/**
 * Clone steps structure with new task IDs (for instance creation)
 * Copies the structure but generates new IDs for all tasks
 * Returns both cloned steps and a mapping of old GUID -> new GUID
 */
function cloneStepsWithNewTaskIds(steps: any): { cloned: any; guidMapping: Map<string, string> } {
  if (!steps || typeof steps !== 'object') {
    return { cloned: {}, guidMapping: new Map() };
  }

  const cloned: any = {};
  const guidMapping = new Map<string, string>();

  // Handle both object format { start: { escalations: [...] } } and array format [{ type: 'start', escalations: [...] }]
  if (Array.isArray(steps)) {
    const clonedArray = steps.map((step: any) => ({
      ...step,
      escalations: (step.escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
    }));
    return { cloned: clonedArray, guidMapping };
  }

  for (const [stepKey, stepValue] of Object.entries(steps)) {
    if (stepValue && typeof stepValue === 'object') {
      if (Array.isArray((stepValue as any).escalations)) {
        // Format: { start: { escalations: [...] } }
        cloned[stepKey] = {
          ...stepValue,
          escalations: ((stepValue as any).escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
        };
      } else if ((stepValue as any).type) {
        // Format: { start: { type: 'start', escalations: [...] } }
        cloned[stepKey] = {
          ...stepValue,
          escalations: ((stepValue as any).escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
        };
      } else {
        cloned[stepKey] = stepValue;
      }
    } else {
      cloned[stepKey] = stepValue;
    }
  }

  return { cloned, guidMapping };
}

/**
 * Clone escalation with new task IDs
 * Maintains mapping of old GUID -> new GUID for translation copying
 * ✅ NEW: Adds templateTaskId and edited fields for template override tracking
 * ✅ CRITICAL: Ensures type and templateId are ALWAYS present (required by compiler)
 *
 * VALIDAZIONE TASK
 * type: obbligatorio. Non può essere undefined o null.
 * templateId: deve essere sempre presente come chiave.
 *   - può essere null → task standalone nel template (valido)
 *   - non può essere undefined → errore (campo mancante)
 * In sintesi:
 *   type === undefined || type === null → ERRORE
 *   templateId === undefined → ERRORE
 *   templateId === null → OK (template standalone)
 *
 * 🔍 Perché questa distinzione è fondamentale
 * ✔️ undefined = campo mancante → errore
 * Significa che il task è stato costruito male, o che qualcuno ha dimenticato di impostare il campo.
 * ✔️ null = valore esplicito → valido
 * Significa:
 * - "questo task non deriva da un template"
 * - "è un task standalone definito direttamente nel template"
 * È un'informazione intenzionale, non un errore.
 *
 * 🔥 Perché è importante
 * Perché senza questo chiarimento, un dev potrebbe pensare:
 * - "templateId null è un errore" → sbagliato
 * - "templateId undefined è uguale a null" → sbagliato
 * - "posso derivare templateId se manca" → NO, fallback mascherato
 * - "posso aggiungere templateId ai template" → NO, il template è la sorgente
 *
 * IMPORTANT: Templates are the source of truth. If a task in a template is missing
 * required fields (type, or has undefined templateId), the template is corrupted and must be fixed
 * in the database, not migrated in runtime.
 */
function cloneEscalationWithNewTaskIds(escalation: any, guidMapping: Map<string, string>): any {
  if (!escalation) return escalation;

  const cloned = {
    ...escalation,
    escalationId: escalation.escalationId ? `e_${uuidv4()}` : undefined,
    tasks: (escalation.tasks || []).map((task: any) => {
      const oldGuid = task.id;
      const newGuid = uuidv4();
      if (oldGuid) {
        guidMapping.set(oldGuid, newGuid);
      }

      // ✅ VALIDAZIONE: type obbligatorio (non può essere undefined o null)
      if (task.type === undefined || task.type === null) {
        throw new Error(`[cloneEscalationWithNewTaskIds] Template task ${task.id || 'unknown'} is missing required field 'type'. The template is corrupted and must be fixed in the database. Task structure: ${JSON.stringify(task, null, 2)}`);
      }

      // ✅ VALIDAZIONE: templateId deve essere presente come chiave (può essere null per task standalone)
      if (task.templateId === undefined) {
        throw new Error(`[cloneEscalationWithNewTaskIds] Template task ${task.id || 'unknown'} is missing required field 'templateId' (must be explicitly null for standalone tasks, or a GUID if derived from another template). The template is corrupted and must be fixed in the database. Task structure: ${JSON.stringify(task, null, 2)}`);
      }

      // ✅ STEP 1: Clona i parametri e genera nuovi GUID per i parametri "text"
      const clonedParameters = (task.parameters || []).map((param: any) => {
        // ✅ Se è il parametro "text" e contiene un GUID, genera un nuovo GUID
        if (param.parameterId === 'text' && param.value) {
          const textValue = String(param.value);
          // ✅ Verifica se è un GUID (formato UUID v4)
          const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (GUID_REGEX.test(textValue)) {
            // ✅ È un GUID del template, genera un nuovo GUID per l'istanza
            const newTextGuid = uuidv4();
            guidMapping.set(textValue, newTextGuid); // ✅ Aggiungi mapping per copiare traduzioni
            return {
              ...param,
              value: newTextGuid // ✅ Sostituisci con nuovo GUID
            };
          }
          // ❌ Se non è un GUID, è testo letterale (errore nel template)
          // Mantieni il valore originale ma logga un warning
          console.warn('[cloneEscalationWithNewTaskIds] ⚠️ Template parameter "text" contains literal text instead of GUID', {
            taskId: task.id,
            parameterValue: textValue.substring(0, 50) + (textValue.length > 50 ? '...' : '')
          });
        }
        // ✅ Per tutti gli altri parametri, mantieni il valore originale
        return param;
      });

      return {
        ...task,
        id: newGuid,  // ✅ New ID for task instance
        type: task.type,  // ✅ NO FALLBACK - must be present in template
        templateId: task.templateId,  // ✅ NO FALLBACK - must be present in template (can be null)
        templateTaskId: oldGuid || null,  // ✅ Save original template task ID
        edited: false,  // ✅ Mark as not edited (inherited from template)
        parameters: clonedParameters, // ✅ Parametri clonati con nuovi GUID per "text"
      };
    })
    // ❌ RIMOSSO: actions - legacy field, non più necessario
  };

  return cloned;
}

/**
 * Marks a task as edited when user modifies it
 * This prevents the task from inheriting future template updates
 */
/**
 * Mark a specific task as edited in the steps array
 * ✅ NUOVO: Gestisce dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
 */
export function markTaskAsEdited(
  steps: Record<string, Record<string, any>>,
  templateId: string,
  stepType: string,
  escalationIndex: number,
  taskIndex: number
): void {
  // ✅ Lookup diretto: O(1) invece di O(n) filter
  const nodeSteps = steps?.[templateId];
  if (!nodeSteps || typeof nodeSteps !== 'object') {
    return;
  }

  const step = nodeSteps[stepType];
  if (!step || !Array.isArray(step.escalations)) {
    return;
  }

  // ✅ Verifica escalation e task
  if (escalationIndex < step.escalations.length) {
    const esc = step.escalations[escalationIndex];
    if (esc?.tasks && Array.isArray(esc.tasks) && taskIndex < esc.tasks.length) {
      const task = esc.tasks[taskIndex];
      task.edited = true;
      return; // ✅ Trovato e modificato
    }
  }
}

/**
 * Migrates existing tasks to include templateTaskId and edited flags
 * ✅ NUOVO: Gestisce dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
 * Rule: if templateTaskId is missing → edited = true (cannot determine if inherited)
 */
export function migrateTaskOverrides(steps: Record<string, Record<string, any>>): void {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
    return; // Non è un dictionary valido
  }

  // ✅ Itera su dictionary: per ogni templateId
  for (const templateId in steps) {
    const nodeSteps = steps[templateId];
    if (!nodeSteps || typeof nodeSteps !== 'object' || Array.isArray(nodeSteps)) {
      continue;
    }

    // ✅ Per ogni stepType (start, noMatch, etc.)
    for (const stepType in nodeSteps) {
      const step = nodeSteps[stepType];
      if (!step || !Array.isArray(step.escalations)) {
        continue;
      }

      // ✅ Per ogni escalation
      step.escalations.forEach((esc: any) => {
        if (esc?.tasks && Array.isArray(esc.tasks)) {
          esc.tasks.forEach((task: any) => {
            if (task.templateTaskId === undefined) {
              task.templateTaskId = null;
              task.edited = true;  // ✅ Cannot determine if inherited
            }
          });
        }
      });
    }
  }
}

/**
 * Compares instance tasks with template tasks and returns list of tasks that need sync
 * Only checks tasks with edited = false and templateTaskId !== null
 */
export async function syncTasksWithTemplate(
  instanceSteps: Record<string, any>,
  template: any,
  templateId: string
): Promise<Array<{
  templateId: string;
  stepType: string;
  escalationIndex: number;
  taskIndex: number;
  instanceTask: any;
  templateTask: any;
  differences: { field: string; instanceValue: any; templateValue: any }[];
}>> {
  const syncNeeded: Array<{
    templateId: string;
    stepType: string;
    escalationIndex: number;
    taskIndex: number;
    instanceTask: any;
    templateTask: any;
    differences: { field: string; instanceValue: any; templateValue: any }[];
  }> = [];

  if (!instanceSteps || !template?.steps) return syncNeeded;

  const nodeSteps = instanceSteps[templateId];
  if (!nodeSteps) return syncNeeded;

  const templateSteps = template.steps[templateId] || template.steps;
  if (!templateSteps) return syncNeeded;

  // Helper to compare task values
  const compareTaskValues = (instanceTask: any, templateTask: any): Array<{ field: string; instanceValue: any; templateValue: any }> => {
    const differences: Array<{ field: string; instanceValue: any; templateValue: any }> = [];

    // ❌ RIMOSSO: Compare text - task.text non deve esistere
    // Il modello corretto è: task contiene solo GUID, traduzione in translations[GUID]

    // Compare parameters[].value
    const instanceParams = instanceTask.parameters || [];
    const templateParams = templateTask.parameters || [];

    // Compare by parameterId
    const paramMap = new Map<string, any>();
    templateParams.forEach((p: any) => {
      const key = p.parameterId || p.key || p.id;
      if (key) paramMap.set(key, p.value);
    });

    instanceParams.forEach((p: any) => {
      const key = p.parameterId || p.key || p.id;
      if (key) {
        const templateValue = paramMap.get(key);
        if (p.value !== templateValue) {
          differences.push({
            field: `parameters[${key}]`,
            instanceValue: p.value,
            templateValue: templateValue
          });
        }
      }
    });

    return differences;
  };

  // Helper to find task in template by templateTaskId
  const findTemplateTask = (templateTaskId: string, stepType: string, escalationIndex: number): any => {
    const step = templateSteps[stepType];
    if (!step) return null;

    // Case A: steps as object
    if (!Array.isArray(step) && step.escalations?.[escalationIndex]?.tasks) {
      return step.escalations[escalationIndex].tasks.find((t: any) => t.id === templateTaskId);
    }

    // Case B: steps as array
    if (Array.isArray(step)) {
      const group = step.find((g: any) => g?.type === stepType);
      if (group?.escalations?.[escalationIndex]?.tasks) {
        return group.escalations[escalationIndex].tasks.find((t: any) => t.id === templateTaskId);
      }
    }

    return null;
  };

  // Iterate through instance steps
  // Case A: steps as object
  if (!Array.isArray(nodeSteps)) {
    for (const stepType in nodeSteps) {
      const step = nodeSteps[stepType];
      if (step?.escalations && Array.isArray(step.escalations)) {
        step.escalations.forEach((esc: any, escIdx: number) => {
          if (esc?.tasks && Array.isArray(esc.tasks)) {
            esc.tasks.forEach((task: any, taskIdx: number) => {
              // Only check tasks with edited = false and templateTaskId !== null
              if (task.edited === false && task.templateTaskId) {
                const templateTask = findTemplateTask(task.templateTaskId, stepType, escIdx);
                if (templateTask) {
                  const differences = compareTaskValues(task, templateTask);
                  if (differences.length > 0) {
                    syncNeeded.push({
                      templateId,
                      stepType,
                      escalationIndex: escIdx,
                      taskIndex: taskIdx,
                      instanceTask: task,
                      templateTask,
                      differences
                    });
                  }
                }
              }
            });
          }
        });
      }
    }
  }

  // Case B: steps as array
  if (Array.isArray(nodeSteps)) {
    nodeSteps.forEach((group: any) => {
      const stepType = group?.type;
      if (stepType && group?.escalations && Array.isArray(group.escalations)) {
        group.escalations.forEach((esc: any, escIdx: number) => {
          if (esc?.tasks && Array.isArray(esc.tasks)) {
            esc.tasks.forEach((task: any, taskIdx: number) => {
              if (task.edited === false && task.templateTaskId) {
                const templateTask = findTemplateTask(task.templateTaskId, stepType, escIdx);
                if (templateTask) {
                  const differences = compareTaskValues(task, templateTask);
                  if (differences.length > 0) {
                    syncNeeded.push({
                      templateId,
                      stepType,
                      escalationIndex: escIdx,
                      taskIndex: taskIdx,
                      instanceTask: task,
                      templateTask,
                      differences
                    });
                  }
                }
              }
            });
          }
        });
      }
    });
  }

  return syncNeeded;
}

/**
 * Clone steps from template with new task IDs
 * Returns cloned steps and guidMapping for translation copying
 *
 * ✅ IMPORTANT: Se data (albero montato) è fornito, usa i templateId dall'albero
 * per gestire correttamente le catene di referenziazione.
 * Se data non è fornito, usa la logica fallback (per retrocompatibilità).
 */
export function cloneTemplateSteps(
  template: any,
  nodes?: TaskTreeNode[]  // ✅ Albero montato con templateId corretti (da buildTaskTreeNodes)
): { steps: Record<string, Record<string, any>>; guidMapping: Map<string, string> } {
  const allGuidMappings = new Map<string, string>();
  const stepsDict: Record<string, Record<string, any>> = {};

  // Helper function to materialize steps from a template
  const materializeStepsFromTemplate = (sourceTemplate: any, nodeTemplateId: string): void => {
    if (!sourceTemplate || !sourceTemplate.steps) {
      return;
    }

    const sourceSteps = sourceTemplate.steps;
    const stepNames = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];

    // ✅ CASE 1: Template composito - steps organizzati per nodeId: template.steps[nodeId] = { start: {...}, ... }
    if (sourceSteps[nodeTemplateId] && typeof sourceSteps[nodeTemplateId] === 'object') {
      const templateSteps = sourceSteps[nodeTemplateId];
      const stepKeys = Object.keys(templateSteps);

      // Inizializza dictionary per questo templateId
      if (!stepsDict[nodeTemplateId]) {
        stepsDict[nodeTemplateId] = {};
      }

      for (const stepKey of stepKeys) {
        const templateStep = templateSteps[stepKey];
        if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
          const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));
          stepsDict[nodeTemplateId][stepKey] = {
            type: stepKey,
            escalations: clonedEscalations,
            id: templateStep.id || `${nodeTemplateId}:${stepKey}`
          };
        }
      }
      return;
    }

    // ✅ CASE 2: Template atomico - steps direttamente in template.steps: template.steps = { start: {...}, ... }
    const sourceStepsKeys = Object.keys(sourceSteps);
    const hasStepNameKeys = sourceStepsKeys.some(key => stepNames.includes(key));

    // ✅ Per template atomici con struttura flat, usa sempre gli steps direttamente
    // Non serve verificare nodeId === templateDataFirstId perché per template atomici
    // gli steps sono sempre per l'unico nodo del template
    if (hasStepNameKeys) {
      // Inizializza dictionary per questo templateId
      if (!stepsDict[nodeTemplateId]) {
        stepsDict[nodeTemplateId] = {};
      }

      // ✅ Template atomico: gli steps sono direttamente in template.steps
      for (const stepKey of sourceStepsKeys) {
        if (stepNames.includes(stepKey)) {
          const templateStep = sourceSteps[stepKey];
          if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
            const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));
            stepsDict[nodeTemplateId][stepKey] = {
              type: stepKey,
              escalations: clonedEscalations,
              id: templateStep.id || `${nodeTemplateId}:${stepKey}`
            };
          }
        }
      }
      return;
    }

  };

  // ✅ Se nodes è fornito, usa i templateId dall'albero montato (PREFERRED)
  if (nodes && Array.isArray(nodes) && nodes.length > 0) {
    // ✅ Iterate over mounted tree - use templateId directly
    const processNode = (node: TaskTreeNode): void => {
      const templateId = node.templateId;
      if (!templateId) {
        return;
      }

      // ✅ Determine which template contains the steps for this node
      // If node has templateId different from main template, steps are in the atomic template
      // Otherwise, steps are in the main template
      if (templateId !== (template.id || template._id)) {
        // ✅ This is a referenced atomic template - get steps from atomic template
        const atomicTemplate = DialogueTaskService.getTemplate(templateId);
        if (atomicTemplate) {
          materializeStepsFromTemplate(atomicTemplate, templateId);
        }
      } else {
        // ✅ This is a main data node - get steps from main template
        materializeStepsFromTemplate(template, templateId);
      }

      // ✅ Process subNodes recursively (support for arbitrary depth)
      if (node.subNodes && Array.isArray(node.subNodes)) {
        node.subNodes.forEach((sub: TaskTreeNode) => {
          processNode(sub);  // ✅ Ricorsione su subNodes[]
        });
      }
    };

    // ✅ Process all nodes in mounted tree
    nodes.forEach((mainNode: TaskTreeNode) => {
      processNode(mainNode);
    });

    return { steps: stepsDict, guidMapping: allGuidMappings };
  }

  return { steps: {}, guidMapping: new Map<string, string>() };
}

/**
 * Derive subTaskKey from node properties
 * Priority: subTaskKey → labelKey → label → name → id
 * Normalizes: lowercase, replaces non-alphanumeric with _, removes leading numbers
 * Validates: must start with letter or _ and contain only [a-z0-9_]
 */
export function deriveSubTaskKey(node: { subTaskKey?: string; labelKey?: string; label?: string; name?: string; id?: string }): string {
  // Use explicit subTaskKey if present
  if (node.subTaskKey) {
    return node.subTaskKey;
  }

  // Fallback chain: labelKey → label → name → id
  let source = node.labelKey || node.label || node.name || node.id || 'unknown';

  // Normalize: lowercase
  let normalized = String(source).toLowerCase();

  // Replace non-alphanumeric characters with underscore
  normalized = normalized.replace(/[^a-z0-9_]/g, '_');

  // Remove leading numbers
  normalized = normalized.replace(/^\d+/, '');

  // Ensure it starts with letter or underscore
  if (!/^[a-z_]/.test(normalized)) {
    normalized = '_' + normalized;
  }

  // Remove consecutive underscores
  normalized = normalized.replace(/_+/g, '_');

  // Remove leading/trailing underscores
  normalized = normalized.replace(/^_+|_+$/g, '');

  // Final validation: must contain only [a-z0-9_]
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    // Fallback to safe default
    normalized = 'subtask';
  }

  // Ensure it's not empty
  if (!normalized || normalized.length === 0) {
    normalized = 'subtask';
  }

  return normalized;
}

/**
 * Build TaskTreeNode[] from template
 * ✅ Restituisce direttamente TaskTreeNode[] con subNodes[] (non subTasks[])
 * ✅ Elimina la doppia conversione: buildDataTree() → toTaskTreeNode()
 * ✅ Esportato per uso in altri file che hanno bisogno solo della struttura
 */
export function buildTaskTreeNodes(template: any): TaskTreeNode[] {
  // Helper function to recursively dereference subTasksIds
  const buildNode = (subTaskId: string): TaskTreeNode => {
    const subTemplate = DialogueTaskService.getTemplate(subTaskId);
    if (!subTemplate) {
      return {
        id: subTaskId,
        templateId: subTaskId,
        label: undefined,
        subNodes: []
      };
    }

    // ✅ Recursively dereference subTasksIds (support for arbitrary depth)
    const subTasksIds = subTemplate.subTasksIds || [];
    const subNodes = subTasksIds.map(buildNode);

    // ✅ Costruisci TaskTreeNode direttamente con subNodes[]
    const node: TaskTreeNode = {
      id: subTemplate.id || subTemplate._id,
      templateId: subTemplate.id || subTemplate._id,
      label: subTemplate.label,
      type: subTemplate.type,
      icon: subTemplate.icon || 'FileText',
      constraints: subTemplate.constraints || [],
      dataContract: subTemplate.dataContract || undefined,
      subNodes  // ✅ Direttamente subNodes[], non subTasks[]
    };

    // ✅ Derive and set subTaskKey
    node.subTaskKey = deriveSubTaskKey({
      labelKey: subTemplate.labelKey,
      label: subTemplate.label,
      name: subTemplate.name,
      id: subTemplate.id || subTemplate._id
    });

    return node;
  };

  // ✅ NUOVO MODELLO: Build from subTasksIds (composite template)
  const subTasksIds = template.subTasksIds || [];
  if (subTasksIds.length > 0) {
    const subNodes = subTasksIds.map(buildNode);

    // ✅ FIX: Ritorna nodo radice con subNodes (non solo sub-nodi)
    // Questo permette a extractStartPrompts di identificare correttamente il nodo radice
    // e adattare solo quello, lasciando i sub-nodi con i prompt originali del template
    const rootNode: TaskTreeNode = {
      id: template.id || template._id,
      templateId: template.id || template._id,
      label: template.label || template.name || undefined,  // ✅ "Date" dal template
      type: template.type,
      icon: template.icon || 'Calendar',
      constraints: template.constraints || [],
      dataContract: template.dataContract || undefined,
      subNodes  // ✅ Day, Month, Year come subNodes
    };

    // ✅ Derive and set subTaskKey for root node
    rootNode.subTaskKey = deriveSubTaskKey({
      labelKey: template.labelKey,
      label: template.label,
      name: template.name,
      id: template.id || template._id
    });

    return [rootNode];
  }

  // Template semplice
  if (!template.label && !template.name) {
    const labelForHeuristics = template.id || 'UNKNOWN';
  }

  const simpleNode: TaskTreeNode = {
    id: template.id || template._id,
    templateId: template.id || template._id,
    label: template.label || template.name || undefined,
    type: template.type,
    icon: template.icon || 'Calendar',
    constraints: template.constraints || [],
    dataContract: template.dataContract || undefined,
    subNodes: []
  };

  // ✅ Derive and set subTaskKey for simple node
  simpleNode.subTaskKey = deriveSubTaskKey({
    labelKey: template.labelKey,
    label: template.label,
    name: template.name,
    id: template.id || template._id
  });

  return [simpleNode];
}

/**
 * Build templateExpanded (baseline) from template only
 * Usato per confronti con working copy
 *
 * @param templateId - Template ID
 * @param projectId - Project ID (opzionale, per caricare template dal progetto)
 * @returns TaskTree espanso dal template (baseline per confronti)
 */
export async function buildTemplateExpanded(
  templateId: string,
  projectId?: string
): Promise<TaskTree | null> {
  if (!templateId) return null;

  // ✅ Carica template - NO FALLBACK to database
  const template = DialogueTaskService.getTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found in memory cache. Templates must be in memory - no fallback to database.`);
  }

  // ✅ Costruisci nodes dal template
  const nodes = buildTaskTreeNodes(template);

  // ✅ Clona steps dal template (baseline, senza modifiche)
  const { steps: clonedSteps } = cloneTemplateSteps(template, nodes);

  return {
    labelKey: template.labelKey || template.label,  // ✅ Usa labelKey (o fallback a label per retrocompatibilità)
    nodes,
    steps: clonedSteps,  // ✅ Dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
    constraints: template.constraints ?? undefined,
    dataContract: template.dataContract ?? undefined,
    introduction: template.introduction
  };
}

/**
 * Build TaskTree from template and instance
 * TaskTree è una vista runtime costruita da Template + Instance
 * NON è un'entità persistita, è solo una vista in memoria per l'editor
 *
 * @param instance - Task instance (DEVE avere templateId o viene creato automaticamente)
 * @param projectId - Project ID (obbligatorio per creare template se necessario)
 * @returns TaskTree costruito da template + instance
 */
/**
 * ✅ ARCHITECTURAL: Build TaskTree from repository (always uses fresh instance)
 * This ensures that _disabled flags and other in-memory changes are always reflected.
 *
 * @param taskId - Task ID to load from repository
 * @param projectId - Optional project ID
 * @returns TaskTree or null if task not found
 */
export async function buildTaskTreeFromRepository(
  taskId: string,
  projectId?: string
): Promise<TaskTree | null> {
  // ✅ CRITICAL: Always read fresh instance from repository (single source of truth in memory)
  const { taskRepository } = await import('../services/TaskRepository');
  const freshInstance = taskRepository.getTask(taskId);
  if (!freshInstance) {
    console.warn(`[buildTaskTreeFromRepository] Task ${taskId} not found in repository`);
    return null;
  }

  // ✅ Delegate to pure buildTaskTree with fresh instance
  return await buildTaskTree(freshInstance, projectId);
}

/**
 * ✅ PURE FUNCTION: Build TaskTree from Task instance
 * This function is pure - it does not read from repository.
 * Use buildTaskTreeFromRepository() if you need to ensure fresh instance from repository.
 *
 * @param instance - Task instance (must be fresh from repository if you need latest _disabled flags)
 * @param projectId - Optional project ID
 * @returns TaskTree or null if instance is null
 */
export async function buildTaskTree(
  instance: Task | null,
  projectId?: string
): Promise<TaskTree | null> {
  if (!instance) return null;

  // ✅ CRITICAL: Ogni task DEVE avere templateId
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    if (!projectId) {
      throw new Error('[buildTaskTree] Cannot create template: projectId is required');
    }

    // ✅ Crea template automaticamente nel progetto
    const autoTemplate = await ensureTemplateExists(instance, undefined, projectId);
    instance.templateId = autoTemplate.id;
  }

  // ✅ ARCHITECTURE: Template must exist by construction
  // First check in-memory cache (DialogueTaskService)
  // ✅ Log rimosso: troppo verboso

  let template = DialogueTaskService.getTemplate(instance.templateId);

  // ✅ DEBUG: Log all templates in cache if template not found
  if (!template) {
    const allTemplates = DialogueTaskService.getAllTemplates();
    const allTemplateIds = allTemplates.map(t => ({
      id: t.id,
      _id: t._id ? (typeof t._id === 'object' ? t._id.toString() : String(t._id)) : null,
      label: t.label,
      name: t.name
    }));
    // ✅ Mantenuto solo per errori critici
    console.warn('[buildTaskTree] ⚠️ Template not found in cache - showing all templates', {
      searchedTemplateId: instance.templateId,
      searchedTemplateIdType: typeof instance.templateId,
      cacheSize: allTemplates.length,
      allTemplateIds,
      // ✅ DEBUG: Check if there's a case mismatch or similar ID
      similarIds: allTemplateIds.filter(t =>
        t.id && String(t.id).toLowerCase() === String(instance.templateId).toLowerCase()
      )
    });
  }
  // ✅ Log rimosso: troppo verboso (template found)

  // ✅ NO FALLBACK: Template must be in memory cache
  // If not in cache, it doesn't exist (or was deleted) - throw error
  if (!template) {
    const cacheSize = DialogueTaskService.getTemplateCount();
    const cacheLoaded = (DialogueTaskService as any).cacheLoaded;
    const allTemplates = DialogueTaskService.getAllTemplates();
    const allTemplateIds = allTemplates.map(t => ({
      id: t.id,
      _id: t._id ? (typeof t._id === 'object' ? t._id.toString() : String(t._id)) : null,
      label: t.label,
      name: t.name
    }));

    const errorMessage = `Template ${instance.templateId} not found in memory cache. The template does not exist or was deleted. Templates must be in memory - no fallback to database.`;
    console.error('[buildTaskTree] ❌ Template not found in cache - NO FALLBACK:', {
      templateId: instance.templateId,
      templateIdType: typeof instance.templateId,
      taskId: instance.id,
      taskLabel: instance.label,
      cacheSize,
      cacheLoaded,
      allTemplateIds,
      hint: 'The template was deleted or never existed. Check if the template was properly created and added to DialogueTaskService cache.'
    });
    // ✅ NO FALLBACK: Throw error - template must exist in memory
    throw new Error(errorMessage);
  }

  // ✅ Usa buildTaskTreeNodes() per costruire direttamente TaskTreeNode[] con subNodes[]
  const nodes = buildTaskTreeNodes(template);

  // ✅ Steps dall'istanza o clonati dal template
  // ✅ NUOVO: steps è un dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  let finalSteps: Record<string, Record<string, any>>;
  let stepsWereCloned = false;

  // ✅ CRITICAL: Se instance.steps ESISTE (anche se vuoto {}), NON clonare
  // Clona SOLO se instance.steps è undefined o null (prima creazione)
  // {} = "l'utente ha cancellato tutti gli step" → NON clonare
  // undefined = "istanza nuova" → clonare
  const hasInstanceSteps =
    instance.steps &&
    typeof instance.steps === 'object' &&
    !Array.isArray(instance.steps);

  if (hasInstanceSteps) {
    // ✅ instance.steps esiste → usalo così com'è (anche se vuoto)
    // {} significa "l'utente ha cancellato tutti gli step" → NON clonare
    finalSteps = instance.steps;

    // ✅ Verifica che sia dictionary (non array legacy)
    if (Array.isArray(finalSteps)) {
      // ✅ Converti array legacy in dictionary (se necessario)
      finalSteps = {};
    }

    // ✅ Preserva la struttura esistente (inclusi step cancellati e flag _disabled)
    console.log('[buildTaskTree] ✅ Using instance steps (even if empty)', {
      taskId: instance.id,
      stepsKeys: Object.keys(finalSteps),
      sampleNodeId: Object.keys(finalSteps)[0],
      sampleNodeSteps: Object.keys(finalSteps)[0] ? Object.keys(finalSteps[Object.keys(finalSteps)[0]]) : [],
      isEmpty: Object.keys(finalSteps).length === 0 || (Object.keys(finalSteps)[0] && Object.keys(finalSteps[Object.keys(finalSteps)[0]]).length === 0),
    });
  } else {
    // ✅ Prima creazione: instance.steps è undefined/null → clona dal template
    const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(template, nodes);
    finalSteps = clonedSteps;
    stepsWereCloned = true;

    // 🔍 DEBUG: Verifica quali GUID sono stati clonati
    const firstNodeId = Object.keys(finalSteps)[0];
    const firstNodeSteps = firstNodeId ? finalSteps[firstNodeId] : null;
    const firstStepKey = firstNodeSteps ? Object.keys(firstNodeSteps)[0] : null;
    const firstStep = firstStepKey ? firstNodeSteps[firstStepKey] : null;
    const firstEscalation = firstStep?.escalations?.[0];
    const firstTask = firstEscalation?.tasks?.[0];
    const firstTaskTextKey = firstTask?.parameters?.find((p: any) => p.parameterId === 'text')?.value;
    console.log('[buildTaskTree] 🔍 DEBUG Steps cloned', {
      taskId: instance.id,
      templateId: instance.templateId,
      clonedStepsKeys: Object.keys(finalSteps),
      firstNodeId,
      firstStepKey,
      firstTaskTextKey,
      firstTaskTextKeyIsGuid: firstTaskTextKey ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstTaskTextKey) : false,
      guidMappingSize: guidMapping?.size || 0,
      guidMappingSample: guidMapping && guidMapping.size > 0 ? Array.from(guidMapping.entries()).slice(0, 3) : []
    });

    // ✅ ARCHITECTURAL RULE: Copia traduzioni template → nuovi GUID
    if (guidMapping && guidMapping.size > 0) {
      try {
        const { copyTranslationsForClonedSteps } = await import('./taskTreeMergeUtils');
        await copyTranslationsForClonedSteps(instance, instance.templateId, guidMapping);
        console.log('[buildTaskTree] ✅ Traduzioni copiate per istanza', {
          taskId: instance.id,
          guidMappingSize: guidMapping.size,
          templateId: instance.templateId
        });
      } catch (err) {
        console.error('[buildTaskTree] ❌ Errore copiando traduzioni:', err);
        // Non bloccare il flusso - l'istanza viene comunque creata
      }
    } else {
      console.warn('[buildTaskTree] ⚠️ Nessun GUID mapping disponibile per copiare traduzioni', {
        taskId: instance.id,
        hasGuidMapping: !!guidMapping,
        guidMappingSize: guidMapping?.size || 0
      });
    }
  }

  // ✅ NUOVO MODELLO: Salva gli step clonati nell'istanza in memoria immediatamente
  // Questo assicura che l'istanza sia sempre completa e sia la fonte di verità
  if (stepsWereCloned) {
    // ✅ Aggiorna l'istanza in memoria con gli step clonati
    // Importa TaskRepository solo quando necessario (evita circular dependencies)
    const { taskRepository } = await import('../services/TaskRepository');
    const existingTask = taskRepository.getTask(instance.id);
    if (existingTask) {
      // ✅ Aggiorna solo gli step, mantenendo tutti gli altri campi
      taskRepository.updateTask(instance.id, { steps: finalSteps }, projectId);
    }
  }

  // ✅ Carica templateVersion dal template (per drift detection)
  const templateVersion = template.version || 1;

  const result = {
    labelKey: instance.labelKey ?? template.labelKey ?? template.label,  // ✅ Usa labelKey (fallback a label per retrocompatibilità)
    nodes,  // ✅ Già TaskTreeNode[] con subNodes[]
    steps: finalSteps,  // ✅ Dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
    constraints: template.constraints ?? undefined,
    dataContract: template.dataContract ?? undefined,
    introduction: template.introduction ?? instance.introduction
  };

  return result;
}

// ❌ RIMOSSO: buildDataTree() - sostituito da buildTaskTreeNodes()
// ❌ RIMOSSO: buildDataFromTemplate() - deprecato, non più necessario

/**
 * Copy translations for cloned steps
 * Uses guidMapping to map old GUIDs (from template) to new GUIDs (in instance)
 * Loads translations for old GUIDs and saves them for new GUIDs
 */
async function copyTranslationsForClonedSteps(_ddt: any, _templateId: string, guidMapping: Map<string, string>): Promise<void> {
  try {
    if (!guidMapping || guidMapping.size === 0) {
      return; // No mappings to process
    }

    // Get old GUIDs (from template) - these have translations in the database
    const oldGuids = Array.from(guidMapping.keys());

    // Load template translations for OLD GUIDs (these exist in the database)
    const { getTemplateTranslations } = await import('../services/ProjectDataService');
    const templateTranslations = await getTemplateTranslations(oldGuids);

    // Get project locale
    const projectLocale = (localStorage.getItem('project.lang') || 'it') as 'en' | 'it' | 'pt';

    // Build translations dictionary for instance (NEW GUIDs -> text from template)
    // Map: oldGuid -> newGuid -> text
    const instanceTranslations: Record<string, string> = {};
    for (const oldGuid of oldGuids) {
      const newGuid = guidMapping.get(oldGuid);
      if (!newGuid) continue;

      const templateTrans = templateTranslations[oldGuid];
      if (templateTrans) {
        // Extract text for project locale
        const text = typeof templateTrans === 'object'
          ? (templateTrans[projectLocale] || templateTrans.en || templateTrans.it || templateTrans.pt || '')
          : String(templateTrans);

        if (text) {
          instanceTranslations[newGuid] = text; // ✅ Use NEW GUID as key
        }
      }
    }

    // Add translations to global table via window context (in memory) AND save to database
    if (Object.keys(instanceTranslations).length > 0) {
      // Try to add to in-memory context first
      const translationsContext = (window as any).__projectTranslationsContext;
      if (translationsContext && translationsContext.addTranslations) {
        translationsContext.addTranslations(instanceTranslations);
      }

      // ✅ Always save directly to database (even if context is not available)
      try {
        // Try multiple methods to get project ID
        let projectId: string | null = null;
        try {
          projectId = localStorage.getItem('currentProjectId');
        } catch { }
        if (!projectId) {
          try {
            const runtime = await import('../state/runtime');
            projectId = runtime.getCurrentProjectId();
          } catch { }
        }
        if (!projectId) {
          projectId = (window as any).currentProjectId || (window as any).__currentProjectId || null;
        }

        if (projectId) {
          const { saveProjectTranslations } = await import('../services/ProjectDataService');
          const projectLocale = (localStorage.getItem('project.lang') || 'it') as 'en' | 'it' | 'pt';

          const translationsToSave = Object.entries(instanceTranslations).map(([guid, text]) => ({
            guid,
            language: projectLocale,
            text: text as string,
            type: 'Instance'
          }));

          await saveProjectTranslations(projectId, translationsToSave);

          // ✅ Reload translations in context if available (to ensure UI sees the new translations)
          const translationsContext = (window as any).__projectTranslationsContext;
          if (translationsContext && translationsContext.loadAllTranslations) {
            try {
              await translationsContext.loadAllTranslations();
            } catch (reloadErr) {
              // Silent fail
            }
          }
        }
      } catch (saveErr) {
        // Silent fail
      }
    }
  } catch (err) {
    // Silent fail
  }
}


// ❌ RIMOSSO: findTemplateNodeByTemplateId e enrichSubDataFromInstance
// Queste funzioni non sono più necessarie perché buildDDTFromTask
// ora ricostruisce sempre l'albero da templateId usando buildDataTree,
// invece di iterare su instance.data




/**
 * Check if data contracts (constraints/examples/nlpContract) have been modified in instance
 * ❌ DEPRECATED: Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
 * This function now always returns false since instances should not contain contracts
 */
export function hasDataContractOverrides(_instance: Task | null): boolean {
  // ✅ Constraints/examples/nlpContract are ALWAYS from template, instances should not have them
  return false;
}

/**
 * Compare only data structure (without logic/overrides)
 * Returns true if structure is identical, false if different
 *
 * Structure includes:
 * - data[].id, label, type
 * - data[].subTasks[] (array with templateId)
 * - Semantics (Atomic/Composite/Collection)
 *
 * Structure does NOT include:
 * - steps, escalations (logic)
 * - constraints, examples, nlpContract (overrides)
 */
function compareDataStructure(localdata: any[], templateData: any[]): boolean {
  if (localdata.length !== templateData.length) {
    return false; // Different number of data nodes
  }

  for (let i = 0; i < localdata.length; i++) {
    const localNode = localdata[i];
    const templateNode = templateData[i] || templateData[0]; // Fallback to first

    // Compare main node structure (id, label, type, templateId)
    if (localNode.id !== templateNode.id ||
      localNode.label !== templateNode.label ||
      localNode.type !== templateNode.type ||
      localNode.templateId !== templateNode.templateId) {
      return false; // Structure changed
    }

    // Compare subData structure (only templateId, not logic)
    const localSubData = localdata[i].subTasks || [];
    const templateSubData = templateNode.subTasks || [];

    if (localSubData.length !== templateSubData.length) {
      return false; // Different number of subData
    }

    for (let j = 0; j < localSubData.length; j++) {
      const localSub = localSubData[j];
      const templateSub = templateSubData[j];

      // Compare subData structure (templateId, label)
      if (localSub.templateId !== templateSub.templateId ||
        localSub.label !== templateSub.label) {
        return false; // Structure changed
      }
    }
  }

  return true; // Structure is identical
}

/**
 * Aggiorna flag edited confrontando workingCopy vs templateExpanded
 * Regole:
 * - Se templateTaskId != null e valori coincidono col template → edited = false
 * - Se templateTaskId != null e valori differiscono → edited = true
 * - Se templateTaskId = null → task nuovo → edited = true (già impostato)
 */
/**
 * Update edited flags by comparing workingCopy vs templateExpanded
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
function updateEditedFlags(workingCopy: TaskTree, templateExpanded: TaskTree): void {
  // ✅ Steps sono ora array MaterializedStep[]
  const workingSteps: MaterializedStep[] = Array.isArray(workingCopy.steps) ? workingCopy.steps : [];
  const templateSteps: MaterializedStep[] = Array.isArray(templateExpanded.steps) ? templateExpanded.steps : [];

  if (workingSteps.length === 0 || templateSteps.length === 0) return;

  // Helper per confrontare valori di un task
  const compareTaskValues = (instanceTask: any, templateTask: any): boolean => {
    // ❌ RIMOSSO: Confronta text - task.text non deve esistere
    // Il modello corretto è: task contiene solo GUID, traduzione in translations[GUID]

    // Confronta parameters[].value
    const instanceParams = instanceTask.parameters || [];
    const templateParams = templateTask.parameters || [];

    const paramMap = new Map<string, any>();
    templateParams.forEach((p: any) => {
      const key = p.parameterId || p.key || p.id;
      if (key) paramMap.set(key, p.value);
    });

    for (const p of instanceParams) {
      const key = p.parameterId || p.key || p.id;
      if (key) {
        const templateValue = paramMap.get(key);
        if (p.value !== templateValue) {
          return false;
        }
      }
    }

    return true;
  };

  // ✅ Helper per trovare step nel template per templateStepId
  const findTemplateStep = (templateStepId: string): MaterializedStep | null => {
    return templateSteps.find((step: MaterializedStep) => step.templateStepId === templateStepId) || null;
  };

  // ✅ Helper per trovare task nel template step per templateTaskId
  const findTemplateTask = (templateTaskId: string, templateStep: MaterializedStep): any => {
    if (!templateStep || !Array.isArray(templateStep.escalations)) return null;

    for (const esc of templateStep.escalations) {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        const task = esc.tasks.find((t: any) => t.id === templateTaskId);
        if (task) return task;
      }
      // ❌ RIMOSSO: Legacy actions check - non più necessario
    }
    return null;
  };

  // ✅ Itera su array MaterializedStep[] della working copy
  for (const workingStep of workingSteps) {
    if (!workingStep || !Array.isArray(workingStep.escalations)) continue;

    // ✅ Trova step corrispondente nel template usando templateStepId
    const templateStep = workingStep.templateStepId
      ? findTemplateStep(workingStep.templateStepId)
      : null;

    // ✅ Se step non ha templateStepId, è un step aggiunto → tutti i task sono edited
    if (!workingStep.templateStepId || !templateStep) {
      workingStep.escalations.forEach((esc: any) => {
        if (esc?.tasks && Array.isArray(esc.tasks)) {
          esc.tasks.forEach((task: any) => {
            task.edited = true;  // ✅ Step aggiunto → tutti i task sono edited
          });
        }
        // ❌ RIMOSSO: Legacy actions check - non più necessario
      });
      continue;
    }

    // ✅ Step derivato: confronta task con template
    workingStep.escalations.forEach((esc: any, escIdx: number) => {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        esc.tasks.forEach((task: any) => {
          if (task.templateTaskId !== null && task.templateTaskId !== undefined) {
            // Task ereditato: confronta con template
            const templateTask = findTemplateTask(task.templateTaskId, templateStep);
            if (templateTask) {
              const valuesMatch = compareTaskValues(task, templateTask);
              task.edited = !valuesMatch;  // edited = false se coincidono, true se differiscono
            } else {
              // Template task non trovato → consideralo modificato
              task.edited = true;
            }
          } else {
            // Task nuovo → edited = true (già impostato, ma assicuriamoci)
            task.edited = true;
          }
        });
      }
      // ❌ RIMOSSO: Legacy actions check - non più necessario
    });
  }
}

/**
 * Salva TUTTA la working copy dell'istanza
 *
 * IMPORTANTE:
 * - L'istanza è un CLONE TOTALE della working copy
 * - Contiene TUTTI gli steps con TUTTI i task
 * - Ogni task ha templateTaskId e flag edited
 * - La struttura (nodes, constraints, dataContract) viene sempre dal template
 * - NON salva: data, constraints, dataContract, examples (vengono dal template)
 *
 * @param instance - Task instance (DEVE avere templateId o viene creato automaticamente)
 * @param workingCopy - TaskTree working copy (vista runtime modificata dall'utente)
 * @param templateExpanded - TaskTree template espanso (baseline per confronti)
 * @param projectId - Project ID (obbligatorio per creare template se necessario)
 * @returns Tutta la working copy da salvare nell'istanza
 */
export async function extractTaskOverrides(
  instance: Task | null,
  workingCopy: TaskTree,
  projectId?: string,
  templateExpanded?: TaskTree
): Promise<Partial<Task>> {
  if (!instance || !workingCopy) {
    return {};
  }

  // ✅ CRITICAL: Ogni task DEVE avere templateId
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    if (!projectId) {
      throw new Error('[extractTaskOverrides] Cannot create template: projectId is required');
    }

    // ✅ Crea template automaticamente nel progetto
    const autoTemplate = await ensureTemplateExists(instance, workingCopy, projectId);
    instance.templateId = autoTemplate.id;
  }

  // ✅ Se templateExpanded è fornito, aggiorna flag edited confrontando workingCopy vs templateExpanded
  if (templateExpanded) {
    updateEditedFlags(workingCopy, templateExpanded);
  }

  // ✅ Carica templateVersion dal template corrente (per drift detection)
  // ✅ NO FALLBACK: Template must be in memory cache
  let template: any = null;
  if (instance.templateId) {
    template = DialogueTaskService.getTemplate(instance.templateId);
    if (!template) {
      throw new Error(`Template ${instance.templateId} not found in memory cache. Templates must be in memory - no fallback to database.`);
    }
  }
  const templateVersion = template?.version || instance.templateVersion || 1;

  // ✅ Salva TUTTA la working copy, non solo override
  // ✅ IMPORTANTE: steps è un dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  const workingSteps = workingCopy.steps;
  const stepsDict: Record<string, Record<string, any>> =
    (workingSteps && typeof workingSteps === 'object' && !Array.isArray(workingSteps))
      ? workingSteps
      : {};  // ✅ Se non è dictionary, inizializza vuoto (legacy format)

  // ✅ CORRETTO: L'istanza contiene SOLO questi campi:
  // - id, templateId, templateVersion, labelKey, steps, createdAt, updatedAt
  // - introduction viene assorbito in uno step normale, non va salvato
  const result: Partial<Task> = {
    labelKey: workingCopy.labelKey || workingCopy.label,  // ✅ Usa labelKey (fallback a label per retrocompatibilità)
    steps: stepsDict,  // ✅ Dictionary: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
    templateVersion: templateVersion  // ✅ Versione del template per drift detection
    // ❌ RIMOSSO: introduction - viene assorbito in uno step normale
  };

  return result;
}

/**
 * ❌ DEPRECATED: Non serve più - gli steps sono già dictionary
 * ✅ RIMOSSO: Gli steps sono già nel formato corretto: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
 * Non serve più convertire da array a dictionary
 */
export function organizeStepsByTemplateId(
  steps: MaterializedStep[],
  nodes: TaskTreeNode[]
): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};

  if (!Array.isArray(steps) || steps.length === 0) {
    return result;
  }

  // ✅ Crea mappa templateId -> node per lookup veloce
  const templateIdToNode = new Map<string, TaskTreeNode>();
  const collectNodes = (nodeList: TaskTreeNode[]) => {
    for (const node of nodeList) {
      if (node.templateId) {
        templateIdToNode.set(node.templateId, node);
      }
      if (node.subNodes && Array.isArray(node.subNodes)) {
        collectNodes(node.subNodes);
      }
    }
  };
  if (nodes && Array.isArray(nodes)) {
    collectNodes(nodes);
  }

  // ✅ Organizza steps per templateId e tipo
  // ✅ IMPORTANTE: Gli steps sono nell'ordine dei nodi (root first, poi subNodes)
  // Quindi possiamo tracciare quale step appartiene a quale templateId usando l'ordine
  let currentStepIndex = 0;

  const processNode = (node: TaskTreeNode, parentTemplateId?: string): void => {
    const nodeTemplateId = node.templateId || parentTemplateId;
    if (!nodeTemplateId) return;

    // ✅ Per ogni nodo, conta quanti steps dovrebbe avere (6 tipi standard)
    const stepTypes = [StepType.START, StepType.NO_MATCH, StepType.NO_INPUT, StepType.CONFIRMATION, StepType.NOT_CONFIRMED, StepType.SUCCESS];
    const stepsForThisNode: MaterializedStep[] = [];

    // ✅ Raccogli steps che appartengono a questo templateId
    // Se hanno templateStepId, estrai templateId da lì
    // Altrimenti, assumi che appartengano al nodo corrente se sono nell'ordine corretto
    for (let i = currentStepIndex; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      let stepTemplateId: string | null = null;
      let stepType: string = 'start';

      // ✅ Estrai templateId da templateStepId (formato: "templateId:stepType")
      if (step.templateStepId) {
        const parts = step.templateStepId.split(':');
        if (parts.length >= 2) {
          stepTemplateId = parts[0];
          stepType = parts[parts.length - 1];
        } else {
          stepType = parts[0] || 'start';
        }
      }

      // ✅ Se non abbiamo templateId da templateStepId, usa il tipo dallo step
      if (step.type) {
        stepType = step.type;
      }

      // ✅ Se lo step ha templateStepId con templateId, verifica se corrisponde
      if (stepTemplateId) {
        if (stepTemplateId === nodeTemplateId) {
          stepsForThisNode.push(step);
          currentStepIndex = i + 1;
        }
        // Se non corrisponde, potrebbe essere per un altro nodo - continua
      } else {
        // ✅ Step senza templateStepId (aggiunto dall'utente) - assegna al nodo corrente
        // Assumiamo che gli steps siano nell'ordine dei nodi
        if (stepsForThisNode.length < stepTypes.length) {
          stepsForThisNode.push(step);
          currentStepIndex = i + 1;
        } else {
          // Abbiamo già raccolto abbastanza steps per questo nodo, passa al prossimo
          break;
        }
      }
    }

    // ✅ Organizza steps per tipo e aggiungi al risultato
    if (stepsForThisNode.length > 0) {
      if (!result[nodeTemplateId]) {
        result[nodeTemplateId] = {};
      }

      for (const step of stepsForThisNode) {
        let stepType = 'start';
        if (step.type) {
          stepType = step.type;
        } else if (step.templateStepId) {
          const parts = step.templateStepId.split(':');
          stepType = parts[parts.length - 1] || 'start';
        }

        const dialogueStep = {
          id: step.id,
          type: stepType,
          escalations: step.escalations || [],
          ...(step.templateStepId ? { templateStepId: step.templateStepId } : {})
        };

        result[nodeTemplateId][stepType] = dialogueStep;
      }
    }

    // ✅ Processa subNodes ricorsivamente
    if (node.subNodes && Array.isArray(node.subNodes)) {
      for (const subNode of node.subNodes) {
        processNode(subNode, nodeTemplateId);
      }
    }
  };

  // ✅ Processa tutti i nodi root
  if (nodes && Array.isArray(nodes)) {
    for (const node of nodes) {
      processNode(node);
    }
  }

  // ✅ Se ci sono ancora steps non assegnati, prova ad assegnarli al primo templateId
  if (currentStepIndex < steps.length && nodes && nodes.length > 0) {
    const firstNode = nodes[0];
    if (firstNode.templateId) {
      if (!result[firstNode.templateId]) {
        result[firstNode.templateId] = {};
      }

      for (let i = currentStepIndex; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue;

        let stepType = 'start';
        if (step.type) {
          stepType = step.type;
        } else if (step.templateStepId) {
          const parts = step.templateStepId.split(':');
          stepType = parts[parts.length - 1] || 'start';
        }

        const dialogueStep = {
          id: step.id,
          type: stepType,
          escalations: step.escalations || [],
          ...(step.templateStepId ? { templateStepId: step.templateStepId } : {})
        };

        result[firstNode.templateId][stepType] = dialogueStep;
      }
    }
  }

  return result;
}

// ❌ RIMOSSO: extractModifiedDDTFields - Usa extractTaskOverrides invece
