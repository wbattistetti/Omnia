import type { Task, TaskTree, TaskTreeNode, MaterializedStep } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TaskType, templateIdToTaskType } from '../types/taskTypes';
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
async function loadTemplateFromProject(templateId: string, projectId: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
    if (!response.ok) return null;

    const tasks = await response.json();
    // ✅ Template ha templateId === null (sono template, non istanze)
    const template = tasks.find((t: any) => t.id === templateId && t.templateId === null);
    return template || null;
  } catch (error) {
    console.error('[loadTemplateFromProject] Error loading template from project:', error);
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
    // ✅ Prima prova dalla cache (Factory)
    const existing = DialogueTaskService.getTemplate(instance.templateId);
    if (existing) return existing;

    // ✅ Se non è in cache, prova a caricarlo dal progetto
    const projectTemplate = await loadTemplateFromProject(instance.templateId, projectId);
    if (projectTemplate) {
      return projectTemplate;
    }
  }

  // ✅ Crea nuovo template nel progetto
  const newTemplateId = uuidv4();

  // Costruisci struttura template da taskTree o da instance (legacy)
  const templateData: any = {
    id: newTemplateId,
    type: instance.type || TaskType.UtteranceInterpretation,
    templateId: null,  // ✅ Template ha sempre templateId === null
    label: instance.label || taskTree?.label || 'New Template',
    icon: 'FileText',
    subTasksIds: taskTree?.nodes?.map(n => n.templateId).filter(Boolean) || [],
    steps: {},  // Steps vuoti nel template (saranno clonati nelle istanze)
    constraints: taskTree?.constraints || [],
    dataContract: taskTree?.dataContract || undefined,
    introduction: taskTree?.introduction || undefined,
    valueSchema: {},  // ✅ Campo obbligatorio per compatibilità con vecchio endpoint (se presente)
    // ❌ NON salvare: data (usa subTasksIds)
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

  console.log('[ensureTemplateExists] ✅ Template creato automaticamente nel progetto', {
    templateId: newTemplateId,
    projectId,
    label: saved.label,
    subTasksIdsCount: saved.subTasksIds?.length || 0
  });

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

      return {
        ...task,
        id: newGuid,  // ✅ New ID for task instance
        type: task.type,  // ✅ NO FALLBACK - must be present in template
        templateId: task.templateId,  // ✅ NO FALLBACK - must be present in template (can be null)
        templateTaskId: oldGuid || null,  // ✅ Save original template task ID
        edited: false,  // ✅ Mark as not edited (inherited from template)
        // Keep params, text, etc. from original
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
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
export function markTaskAsEdited(
  steps: MaterializedStep[] | Record<string, any>,
  templateId: string,
  stepType: string,
  escalationIndex: number,
  taskIndex: number
): void {
  // ✅ Gestione retrocompatibilità: se è dictionary, non possiamo modificarlo direttamente
  if (!Array.isArray(steps)) {
    console.warn('[markTaskAsEdited] ⚠️ Steps è un dictionary (legacy), operazione non supportata');
    return;
  }

  // ✅ Trova step per templateStepId (se stepType corrisponde a un templateStepId)
  // Nota: stepType potrebbe essere 'start', 'noMatch', etc. - dobbiamo trovare lo step corrispondente
  // Per ora, assumiamo che stepType sia il tipo di step e cerchiamo nel primo step che corrisponde
  // TODO: Migliorare la logica di matching se necessario

  // ✅ Itera su array MaterializedStep[]
  for (const step of steps) {
    if (!step || !Array.isArray(step.escalations)) continue;

    // ✅ Verifica se questo step corrisponde (per ora, controlliamo solo escalations)
    if (escalationIndex < step.escalations.length) {
      const esc = step.escalations[escalationIndex];
      if (esc?.tasks && Array.isArray(esc.tasks) && taskIndex < esc.tasks.length) {
        const task = esc.tasks[taskIndex];
        task.edited = true;
        return; // ✅ Trovato e modificato
      }
      // ❌ RIMOSSO: Legacy actions check - non più necessario
    }
  }

  console.warn('[markTaskAsEdited] ⚠️ Step o task non trovato', {
    templateId,
    stepType,
    escalationIndex,
    taskIndex,
    stepsCount: steps.length
  });
}

/**
 * Migrates existing tasks to include templateTaskId and edited flags
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 * Rule: if templateTaskId is missing → edited = true (cannot determine if inherited)
 */
export function migrateTaskOverrides(steps: MaterializedStep[] | Record<string, any>): void {
  // ✅ Gestione retrocompatibilità: se è dictionary, converti in array
  if (!Array.isArray(steps)) {
    if (steps && typeof steps === 'object') {
      console.warn('[migrateTaskOverrides] ⚠️ Steps è un dictionary (legacy), convertendo in array');
      // ✅ Converti dictionary in array (per retrocompatibilità)
      const stepsArray: MaterializedStep[] = [];
      for (const templateId in steps) {
        const nodeSteps = steps[templateId];
        if (!nodeSteps || typeof nodeSteps !== 'object') continue;

        // Case A: steps as object { start: { escalations: [...] } }
        if (!Array.isArray(nodeSteps)) {
          for (const stepType in nodeSteps) {
            const step = nodeSteps[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              stepsArray.push({
                id: uuidv4(),
                templateStepId: step.id || `${templateId}:${stepType}`,
                escalations: step.escalations
              });
            }
          }
        }
        // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
        else if (Array.isArray(nodeSteps)) {
          nodeSteps.forEach((group: any) => {
            if (group?.escalations && Array.isArray(group.escalations)) {
              stepsArray.push({
                id: uuidv4(),
                templateStepId: group.id || group.templateStepId,
                escalations: group.escalations
              });
            }
          });
        }
      }
      steps = stepsArray;
    } else {
      return; // Non è né array né dictionary valido
    }
  }

  // ✅ Itera su array MaterializedStep[]
  for (const step of steps) {
    if (!step || !Array.isArray(step.escalations)) continue;

    step.escalations.forEach((esc: any) => {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        esc.tasks.forEach((task: any) => {
          if (task.templateTaskId === undefined) {
            task.templateTaskId = null;
            task.edited = true;  // ✅ Cannot determine if inherited
          }
        });
      }
      // ❌ RIMOSSO: Legacy actions check - non più necessario
    });
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

    // Compare text
    if (instanceTask.text !== templateTask.text) {
      differences.push({
        field: 'text',
        instanceValue: instanceTask.text,
        templateValue: templateTask.text
      });
    }

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
): { steps: MaterializedStep[]; guidMapping: Map<string, string> } {
  const allGuidMappings = new Map<string, string>();
  const materializedSteps: MaterializedStep[] = [];

  // Helper function to materialize steps from a template
  const materializeStepsFromTemplate = (sourceTemplate: any, nodeTemplateId: string): void => {
    if (!sourceTemplate || !sourceTemplate.steps) {
      console.warn('⚠️ [materializeStepsFromTemplate] Template senza steps', {
        nodeTemplateId,
        templateId: sourceTemplate?.id || sourceTemplate?._id
      });
      return;
    }

    const sourceSteps = sourceTemplate.steps;
    const stepNames = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];

    // ✅ CASE 1: Template composito - steps organizzati per nodeId: template.steps[nodeId] = { start: {...}, ... }
    if (sourceSteps[nodeTemplateId] && typeof sourceSteps[nodeTemplateId] === 'object') {
      const templateSteps = sourceSteps[nodeTemplateId];
      const stepKeys = Object.keys(templateSteps);

      for (const stepKey of stepKeys) {
        const templateStep = templateSteps[stepKey];
        if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
          const instanceStepId = uuidv4();
          const templateStepId = templateStep.id || `${nodeTemplateId}:${stepKey}`;
          const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));
          materializedSteps.push({
            id: instanceStepId,
            templateStepId: templateStepId,
            escalations: clonedEscalations
          });
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
      // ✅ Template atomico: gli steps sono direttamente in template.steps
      for (const stepKey of sourceStepsKeys) {
        if (stepNames.includes(stepKey)) {
          const templateStep = sourceSteps[stepKey];
          if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
            const instanceStepId = uuidv4();
            const templateStepId = templateStep.id || `${nodeTemplateId}:${stepKey}`;
            const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));
            materializedSteps.push({
              id: instanceStepId,
              templateStepId: templateStepId,
              escalations: clonedEscalations
            });
          }
        }
      }
      return;
    }

    // ❌ Steps non trovati
    console.warn('⚠️ [materializeStepsFromTemplate] Steps non trovati', {
      nodeTemplateId,
      templateId: sourceTemplate.id || sourceTemplate._id,
      templateHasSteps: true,
      templateStepsKeys: sourceStepsKeys
    });
  };

  // ✅ Se nodes è fornito, usa i templateId dall'albero montato (PREFERRED)
  if (nodes && Array.isArray(nodes) && nodes.length > 0) {
    // ✅ Iterate over mounted tree - use templateId directly
    const processNode = (node: TaskTreeNode): void => {
      const templateId = node.templateId;
      if (!templateId) {
        console.warn('⚠️ [cloneTemplateSteps] Node senza templateId', { nodeId: node.id, nodeLabel: node.label });
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
        } else {
          console.warn('⚠️ [cloneTemplateSteps] Template atomico non trovato', { templateId });
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

    console.log('[🔍 cloneTemplateSteps] ✅ Steps materializzati', {
      materializedStepsCount: materializedSteps.length,
      stepsDetails: materializedSteps.map((step: MaterializedStep) => ({
        id: step.id,
        templateStepId: step.templateStepId,
        escalationsCount: step.escalations?.length || 0
      }))
    });

    return { steps: materializedSteps, guidMapping: allGuidMappings };
  }

  // ❌ NO FALLBACK: nodes è richiesto
  console.warn('⚠️ [cloneTemplateSteps] nodes non fornito - impossibile clonare steps', {
    templateId: template.id || template._id,
    templateLabel: template.label || template.name
  });
  return { steps: [], guidMapping: new Map<string, string>() };
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
      console.warn('[buildTaskTreeNodes] Sub-template not found:', subTaskId);
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
    return {
      id: subTemplate.id || subTemplate._id,
      templateId: subTemplate.id || subTemplate._id,
      label: subTemplate.label,
      type: subTemplate.type,
      icon: subTemplate.icon || 'FileText',
      constraints: subTemplate.dataContracts || subTemplate.constraints || [],
      dataContract: subTemplate.dataContract || undefined,
      subNodes  // ✅ Direttamente subNodes[], non subTasks[]
    };
  };

  // ✅ NUOVO MODELLO: Build from subTasksIds (composite template)
  const subTasksIds = template.subTasksIds || [];
  if (subTasksIds.length > 0) {
    const subNodes = subTasksIds.map(buildNode);

    // ✅ FIX: Ritorna nodo radice con subNodes (non solo sub-nodi)
    // Questo permette a extractStartPrompts di identificare correttamente il nodo radice
    // e adattare solo quello, lasciando i sub-nodi con i prompt originali del template
    return [{
      id: template.id || template._id,
      templateId: template.id || template._id,
      label: template.label || template.name || undefined,  // ✅ "Date" dal template
      type: template.type,
      icon: template.icon || 'Calendar',
      constraints: template.dataContracts || template.constraints || [],
      dataContract: template.dataContract || undefined,
      subNodes  // ✅ Day, Month, Year come subNodes
    }];
  }

  // Template semplice
  if (!template.label && !template.name) {
    const labelForHeuristics = template.id || 'UNKNOWN';
    console.warn('[buildTaskTreeNodes] Label mancante nel template semplice, uso ID come fallback tecnico per euristiche', {
      templateId: template.id,
      fallbackLabel: labelForHeuristics
    });
  }

  return [{
    id: template.id || template._id,
    templateId: template.id || template._id,
    label: template.label || template.name || undefined,
    type: template.type,
    icon: template.icon || 'Calendar',
    constraints: template.dataContracts || template.constraints || [],
    dataContract: template.dataContract || undefined,
    subNodes: []
  }];
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

  // ✅ Carica template
  let template = DialogueTaskService.getTemplate(templateId);
  if (!template && projectId) {
    const projectTemplate = await loadTemplateFromProject(templateId, projectId);
    if (projectTemplate) {
      template = projectTemplate;
    }
  }

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // ✅ Costruisci nodes dal template
  const nodes = buildTaskTreeNodes(template);

  // ✅ Clona steps dal template (baseline, senza modifiche)
  const { steps: materializedSteps } = cloneTemplateSteps(template, nodes);

  return {
    labelKey: template.labelKey || template.label,  // ✅ Usa labelKey (o fallback a label per retrocompatibilità)
    nodes,
    steps: materializedSteps,  // ✅ Ora è un array MaterializedStep[], non un dictionary
    constraints: template.dataContracts ?? template.constraints ?? undefined,
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
    console.warn('[buildTaskTree] Task senza templateId - creando template automaticamente', {
      taskId: instance.id,
      taskLabel: instance.label,
      projectId
    });

    const autoTemplate = await ensureTemplateExists(instance, undefined, projectId);
    instance.templateId = autoTemplate.id;
  }

  // ✅ SEMPRE costruisci da template
  let template = DialogueTaskService.getTemplate(instance.templateId);

  // ✅ Se non è in cache, prova a caricarlo dal progetto
  if (!template && projectId) {
    const projectTemplate = await loadTemplateFromProject(instance.templateId, projectId);
    if (projectTemplate) {
      template = projectTemplate;
    }
  }

  if (!template) {
    throw new Error(`Template ${instance.templateId} not found`);
  }

  // ✅ Usa buildTaskTreeNodes() per costruire direttamente TaskTreeNode[] con subNodes[]
  const nodes = buildTaskTreeNodes(template);

  // ✅ Steps dall'istanza o clonati dal template
  // ✅ NUOVO: steps è un array MaterializedStep[], non un dictionary
  let finalSteps: MaterializedStep[] = Array.isArray(instance.steps) ? instance.steps : [];
  let stepsWereCloned = false;

  if (!finalSteps || finalSteps.length === 0) {
    // ✅ Prima creazione: clona steps dal template
    const { steps: materializedSteps } = cloneTemplateSteps(template, nodes);
    finalSteps = materializedSteps;
    stepsWereCloned = true;
  } else {
    // ✅ Migrate existing steps to include templateTaskId and edited
    // TODO: migrateTaskOverrides deve gestire array, non dictionary
    // Per ora, se è array, è già nel formato corretto
    if (!Array.isArray(finalSteps)) {
      console.warn('[buildTaskTree] ⚠️ Steps non è un array, potrebbe essere formato legacy');
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
      console.log('[buildTaskTree] ✅ Steps clonati salvati nell\'istanza in memoria', {
        taskId: instance.id,
        templateId: instance.templateId,
        stepsCount: finalSteps.length
      });
    } else {
      console.warn('[buildTaskTree] ⚠️ Istanza non trovata in TaskRepository, non posso salvare gli step clonati', {
        taskId: instance.id
      });
    }
  }

  // ✅ Carica templateVersion dal template (per drift detection)
  const templateVersion = template.version || 1;

  return {
    labelKey: instance.labelKey ?? template.labelKey ?? template.label,  // ✅ Usa labelKey (fallback a label per retrocompatibilità)
    nodes,  // ✅ Già TaskTreeNode[] con subNodes[]
    steps: finalSteps,  // ✅ Array MaterializedStep[]
    constraints: template.dataContracts ?? template.constraints ?? undefined,
    dataContract: template.dataContract ?? undefined,
    introduction: template.introduction ?? instance.introduction
  };
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
      } else {
        console.warn('[copyTranslationsForClonedSteps] ProjectTranslationsContext not available, will save to DB only');
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
              console.warn('[copyTranslationsForClonedSteps] Failed to reload translations in context:', reloadErr);
            }
          }
        } else {
          console.warn('[copyTranslationsForClonedSteps] No project ID available, cannot save to database');
        }
      } catch (saveErr) {
        console.error('[copyTranslationsForClonedSteps] Error saving translations to database:', saveErr);
      }
    }
  } catch (err) {
    console.error('[copyTranslationsForClonedSteps] Error copying translations:', err);
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
    // Confronta text
    if (instanceTask.text !== templateTask.text) {
      return false;
    }

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
  let template: any = null;
  if (instance.templateId) {
    template = DialogueTaskService.getTemplate(instance.templateId);
    if (!template && projectId) {
      const { loadTemplateFromProject } = await import('./taskUtils');
      template = await loadTemplateFromProject(instance.templateId, projectId);
    }
  }
  const templateVersion = template?.version || instance.templateVersion || 1;

  // ✅ Salva TUTTA la working copy, non solo override
  // ✅ IMPORTANTE: steps è un array MaterializedStep[], non un dictionary
  const workingSteps = workingCopy.steps;
  const materializedSteps: MaterializedStep[] = Array.isArray(workingSteps)
    ? workingSteps
    : [];  // ✅ Se non è array, inizializza vuoto (legacy format)

  // ✅ CORRETTO: L'istanza contiene SOLO questi campi:
  // - id, templateId, templateVersion, labelKey, steps, createdAt, updatedAt
  // - introduction viene assorbito in uno step normale, non va salvato
  const result: Partial<Task> = {
    labelKey: workingCopy.labelKey || workingCopy.label,  // ✅ Usa labelKey (fallback a label per retrocompatibilità)
    steps: materializedSteps,  // ✅ Array MaterializedStep[]
    templateVersion: templateVersion  // ✅ Versione del template per drift detection
    // ❌ RIMOSSO: introduction - viene assorbito in uno step normale
  };

  return result;
}

// ❌ RIMOSSO: extractModifiedDDTFields - Usa extractTaskOverrides invece
