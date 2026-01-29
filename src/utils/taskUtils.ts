import type { Task, TaskTree, TaskTreeNode } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TaskType } from '../types/taskTypes';
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
 * - Chiama buildDataTree(templateId) → ricostruisce l'albero in memoria
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
 *    - Costruito runtime con buildDataTree(templateId)
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
 */
function cloneEscalationWithNewTaskIds(escalation: any, guidMapping: Map<string, string>): any {
  if (!escalation) return escalation;

  const cloned = {
    ...escalation,
    escalationId: escalation.escalationId ? `e_${uuidv4()}` : undefined,
    tasks: (escalation.tasks || escalation.actions || []).map((task: any) => {
      const oldGuid = task.id;
      const newGuid = uuidv4();
      if (oldGuid) {
        guidMapping.set(oldGuid, newGuid);
      }
      return {
        ...task,
        id: newGuid,  // ✅ New ID for task instance
        // Keep templateId, params, etc. from original
      };
    }),
    actions: (escalation.actions || []).map((action: any) => {
      const oldGuid = action.actionInstanceId || action.taskId;
      const newGuid = uuidv4();
      if (oldGuid) {
        guidMapping.set(oldGuid, newGuid);
      }
      return {
        ...action,
        actionInstanceId: newGuid,  // ✅ New ID for action instance (legacy)
        // Keep actionId, parameters, etc. from original
      };
    })
  };

  return cloned;
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
  data?: any[]  // ✅ Albero montato con templateId corretti (da buildDataTree)
): { steps: Record<string, any>; guidMapping: Map<string, string> } {
  const allGuidMappings = new Map<string, string>();
  const clonedSteps: Record<string, any> = {};

  // Helper function to clone steps for a nodeId from a source template
  const cloneStepsForNodeId = (nodeId: string, sourceTemplate: any): void => {
    if (!nodeId || !sourceTemplate) {
      console.warn('⚠️ [cloneStepsForNodeId] Parametri mancanti', { nodeId, hasSourceTemplate: !!sourceTemplate });
      return;
    }

    if (!sourceTemplate.steps) {
      console.warn('⚠️ [cloneStepsForNodeId] Template senza steps', {
        nodeId,
        templateId: sourceTemplate.id || sourceTemplate._id
      });
      return;
    }

    const sourceStepsKeys = Object.keys(sourceTemplate.steps);
    const templateDataFirstId = sourceTemplate.data && Array.isArray(sourceTemplate.data) && sourceTemplate.data.length > 0
      ? sourceTemplate.data[0].id
      : null;

    // ✅ CASE 1: Template composito - steps organizzati per nodeId: template.steps[nodeId] = { start: {...}, ... }
    if (sourceTemplate.steps[nodeId]) {
      const templateSteps = sourceTemplate.steps[nodeId];
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateSteps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
      clonedSteps[nodeId] = cloned;
      // Log rimosso per ridurre rumore - solo log critici
      return;
    }

    // ✅ CASE 2: Template atomico - steps direttamente in template.steps: template.steps = { start: {...}, ... }
    // Verifica se le chiavi sono nomi di step (non GUID)
    const stepNames = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
    const hasStepNameKeys = sourceStepsKeys.some(key => stepNames.includes(key));

    // ✅ Per template atomici con struttura flat, usa sempre gli steps direttamente
    // Non serve verificare nodeId === templateDataFirstId perché per template atomici
    // gli steps sono sempre per l'unico nodo del template
    if (hasStepNameKeys) {
      // ✅ Template atomico: gli steps sono direttamente in template.steps
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(sourceTemplate.steps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
      clonedSteps[nodeId] = cloned;
      // Log rimosso per ridurre rumore - solo log critici
      return;
    }

    // ❌ Steps non trovati
    console.warn('⚠️ [cloneStepsForNodeId] Steps non trovati', {
      nodeId,
      templateId: sourceTemplate.id || sourceTemplate._id,
      templateHasSteps: true,
      templateStepsKeys: sourceStepsKeys,
      templateStepsKeysExpanded: JSON.stringify(sourceStepsKeys),
      lookingFor: nodeId,
      templateDataFirstId: templateDataFirstId,
      nodeIdMatchesDataFirstId: nodeId === templateDataFirstId,
      hasStepNameKeys: hasStepNameKeys
    });
  };

  // ✅ Se data è fornito, usa i templateId dall'albero montato (PREFERRED)
  if (data && Array.isArray(data) && data.length > 0) {


    // ✅ Iterate over mounted tree - use templateId directly (referenceId eliminato)
    const processNode = (node: any): void => {
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
          cloneStepsForNodeId(templateId, atomicTemplate); // ✅ Usa templateId direttamente
        } else {
          console.warn('⚠️ [cloneTemplateSteps] Template atomico non trovato', { templateId });
        }
      } else {
        // ✅ This is a main data node - get steps from main template
        cloneStepsForNodeId(templateId, template); // ✅ Usa templateId direttamente
      }

      // ✅ Process subData recursively (support for arbitrary depth)
      if (node.subTasks && Array.isArray(node.subTasks)) {
        node.subTasks.forEach((sub: any) => {
          processNode(sub);
        });
      }
    };

    // ✅ Process all nodes in mounted tree
    data.forEach((mainNode: any) => {
      processNode(mainNode);
    });

    console.log('[🔍 cloneTemplateSteps] ✅ Steps clonati', {
      clonedStepsCount: Object.keys(clonedSteps).length,
      clonedStepsKeys: Object.keys(clonedSteps),
      clonedStepsDetails: Object.entries(clonedSteps).map(([key, value]: [string, any]) => ({
        key,
        keyPreview: key.substring(0, 40) + '...',
        stepKeys: typeof value === 'object' ? Object.keys(value || {}) : [],
        hasStart: !!value?.start,
        startEscalationsCount: value?.start?.escalations?.length || 0
      }))
    });

    return { steps: clonedSteps, guidMapping: allGuidMappings };
  }

  // ❌ NO FALLBACK: data è richiesto
  console.warn('⚠️ [cloneTemplateSteps] data non fornito - impossibile clonare steps', {
    templateId: template.id || template._id,
    templateLabel: template.label || template.name
  });
  return { steps: {}, guidMapping: new Map<string, string>() };
}

/**
 * Converte un nodo da buildDataTree in TaskTreeNode (ricorsivo)
 * Garantisce che tutto il TaskTree sia nel formato corretto
 */
function toTaskTreeNode(node: any): TaskTreeNode {
  return {
    id: node.id,
    templateId: node.templateId,
    label: node.label,
    type: node.type,
    icon: node.icon,
    constraints: node.constraints,
    dataContract: node.dataContract,
    subNodes: (node.subTasks || []).map(toTaskTreeNode)  // ✅ Ricorsione pulita
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

  // ✅ Costruisci dataTree dal template
  const dataTree = buildDataTree(template);

  // ✅ Converti dataTree in TaskTree usando ricorsione pulita
  const nodes: TaskTreeNode[] = dataTree.map(toTaskTreeNode);

  // ✅ Steps dall'istanza o clonati dal template
  let finalSteps: Record<string, any> = instance.steps || {};
  if (!finalSteps || Object.keys(finalSteps).length === 0) {
    // Prima creazione: clona steps dal template
    const { steps: clonedSteps } = cloneTemplateSteps(template, dataTree);
    finalSteps = clonedSteps;
  }

  return {
    label: instance.label ?? template.label,
    nodes,  // ✅ nodes invece di data
    steps: finalSteps,
    constraints: template.dataContracts ?? template.constraints ?? undefined,
    dataContract: template.dataContract ?? undefined,
    introduction: template.introduction ?? instance.introduction
  };
}

/**
 * Build data tree from template (dereference subTasksIds)
 * Returns only data structure (without steps)
 * ✅ NUOVO MODELLO: Usa solo subTasksIds, non più template.data
 * ✅ NON inventa label: se manca, logga warning e lascia undefined
 */
export function buildDataTree(template: any): any[] {
  // Helper function to recursively dereference subTasksIds
  const buildNodeFromSubTasksIds = (subTaskId: string): any => {
    const subTemplate = DialogueTaskService.getTemplate(subTaskId);
    if (!subTemplate) {
      console.warn('[buildDataTree] Sub-template not found:', subTaskId);
      return {
        id: subTaskId,
        templateId: subTaskId,
        label: undefined,
        subTasks: []
      };
    }

    // ✅ Recursively dereference subTasksIds (support for arbitrary depth)
    const subTasksIds = subTemplate.subTasksIds || [];
    const dereferencedSubTasks = subTasksIds.map(buildNodeFromSubTasksIds);

    // ✅ Costruisci struttura completa dal template
    return {
      id: subTemplate.id || subTemplate._id,
      label: subTemplate.label, // ✅ NON inventare: se manca, sarà undefined
      type: subTemplate.type,
      icon: subTemplate.icon || 'FileText',
      constraints: subTemplate.dataContracts || subTemplate.constraints || [],
      dataContract: subTemplate.dataContract || undefined,
      subTasks: dereferencedSubTasks, // ✅ Supporta profondità arbitraria
      templateId: subTemplate.id || subTemplate._id, // ✅ Solo templateId
      kind: subTemplate.name || subTemplate.type || 'generic'
    };
  };

  // ✅ NUOVO MODELLO: Build from subTasksIds (composite template)
  const subTasksIds = template.subTasksIds || [];
  if (subTasksIds.length > 0) {
    const subDataInstances: any[] = [];
    for (const subId of subTasksIds) {
      const node = buildNodeFromSubTasksIds(subId);
      subDataInstances.push(node);
    }

    // ✅ NON inventare label per main node
    if (!template.label && !template.name) {
      const labelForHeuristics = template.id || 'UNKNOWN';
      console.warn('[buildDataTree] Label mancante nel template composito, uso ID come fallback tecnico per euristiche', {
        templateId: template.id,
        fallbackLabel: labelForHeuristics
      });
    }

    return [{
      id: template.id || template._id,
      label: template.label || template.name || undefined, // ✅ NON inventare
      type: template.type,
      icon: template.icon || 'Calendar',
      constraints: template.dataContracts || template.constraints || [],
      dataContract: template.dataContract || undefined,
      subTasks: subDataInstances,
      templateId: template.id || template._id,
      kind: template.name || template.type || 'generic'
    }];
  }

  // Template semplice
  if (!template.label && !template.name) {
    const labelForHeuristics = template.id || 'UNKNOWN';
    console.warn('[buildDataTree] Label mancante nel template semplice, uso ID come fallback tecnico per euristiche', {
      templateId: template.id,
      fallbackLabel: labelForHeuristics
    });
  }

  return [{
    id: template.id || template._id,
    label: template.label || template.name || undefined, // ✅ NON inventare
    type: template.type,
    icon: template.icon || 'Calendar',
    constraints: template.dataContracts || template.constraints || [],
    examples: template.examples || [],
    dataContract: template.dataContract || undefined, // ✅ CRITICAL: Copia dataContract dal template
    subTasks: [],
    templateId: template.id || template._id,
    kind: template.name || template.type || 'generic'
  }];
}

/**
 * Build data structure from template (reference structure)
 * ✅ DEPRECATED: Usa cloneTemplateSteps + buildDataTree invece
 * Mantenuto per retrocompatibilità
 * Returns both data and guidMapping for translation copying
 */
export function buildDataFromTemplate(template: any): { data: any[]; guidMapping: Map<string, string> } {
  // ✅ Prima monta l'albero completo, poi clona gli steps usando i templateId dall'albero
  const data = buildDataTree(template);
  const { guidMapping } = cloneTemplateSteps(template, data);
  return { data, guidMapping };

}

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
 * Extract only task overrides from TaskTree (compared to template)
 *
 * IMPORTANTE:
 * - Ogni task DEVE avere templateId (o viene creato automaticamente)
 * - L'istanza contiene SOLO override: steps, label, introduction
 * - La struttura (nodes, constraints, dataContract) viene sempre dal template
 * - NON salva più: data, constraints, dataContract, examples
 *
 * @param instance - Task instance (DEVE avere templateId o viene creato automaticamente)
 * @param localTaskTree - TaskTree locale (vista runtime)
 * @param projectId - Project ID (obbligatorio per creare template se necessario)
 * @returns Solo override da salvare nell'istanza
 */
export async function extractTaskOverrides(
  instance: Task | null,
  localTaskTree: TaskTree,
  projectId?: string
): Promise<Partial<Task>> {
  if (!instance || !localTaskTree) {
    return {};
  }

  // ✅ CRITICAL: Ogni task DEVE avere templateId
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    if (!projectId) {
      throw new Error('[extractTaskOverrides] Cannot create template: projectId is required');
    }

    // ✅ Crea template automaticamente nel progetto
    const autoTemplate = await ensureTemplateExists(instance, localTaskTree, projectId);
    instance.templateId = autoTemplate.id;
  }

  // ✅ SEMPRE estrai solo override (non struttura)
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

  const result: Partial<Task> = {};

  // ✅ Label override (solo se diversa dal template)
  if (localTaskTree.label !== template.label) {
    result.label = localTaskTree.label;
  }

  // ✅ Steps override (sempre salva)
  result.steps = instance.steps || {};

  // ✅ Introduction override (solo se diversa dal template)
  if (localTaskTree.introduction !== template.introduction) {
    result.introduction = localTaskTree.introduction;
  }

  // ❌ NON salvare: data, constraints, dataContract (vengono dal template)

  return result;
}

// ❌ RIMOSSO: extractModifiedDDTFields - Usa extractTaskOverrides invece
