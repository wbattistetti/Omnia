import type { Task, MaterializedStep, TaskTreeNode } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { buildTaskTreeNodes, cloneTemplateSteps } from './taskUtils';
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
 * Load TaskTree from template (reference) and instance (steps + overrides)
 *
 * This function loads the TaskTree structure for the editor by combining:
 * - Template structure (nodes, constraints, examples, nlpContract) - source of truth
 * - Instance overrides (steps with cloned task IDs, modified constraints/examples)
 *
 * Rules:
 * - label, steps: Always from instance (always editable)
 * - nodes structure: From template (reference), but allows instance additions
 * - constraints, examples, nlpContract: ALWAYS from template (reference) - NO overrides allowed
 *
 * Structure:
 * - Nodes with templateId !== null: Structure from template, steps cloned with new task IDs, contracts from template
 * - Nodes with templateId === null: Complete structure from instance (added nodes)
 */
export async function loadTaskTreeFromTemplate(instance: Task | null): Promise<any | null> {
  if (!instance) return null;

  // If no templateId or templateId is "UNDEFINED", this is a standalone instance (has full structure)
  // "UNDEFINED" is a placeholder for tasks that haven't been typed yet, not a real template
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    return {
      label: instance.label,
      data: instance.data || [],
      steps: instance.steps,  // ✅ Steps a root level (già nel formato corretto)
      constraints: instance.constraints,
      examples: instance.examples
    };
  }

  // Load template from DialogueTaskService
  const template = DialogueTaskService.getTemplate(instance.templateId);
  if (!template) {
    // Template not found, return instance as-is (fallback)
    console.warn('[ddtMergeUtils] Template not found:', instance.templateId);
    return {
      label: instance.label,
      data: instance.data || [],
      steps: instance.steps,  // ✅ Steps a root level (già nel formato corretto)
      constraints: instance.constraints,
      examples: instance.examples
    };
  }

  // ✅ CRITICAL: Ricostruisci SEMPRE l'albero dal template usando buildTaskTreeNodes()
  const nodes = buildTaskTreeNodes(template);
  // ✅ nodes contiene:
  // - Tutti i nodi principali con templateId corretti
  // - Tutti i subNodes dereferenziati con templateId corretti
  // - Struttura completa del template (TaskTreeNode[] con subNodes[])

  // ✅ Clone steps usando nodes (albero montato con templateId corretti)
  const { guidMapping: templateGuidMapping } = cloneTemplateSteps(template, nodes);

  // ✅ Usa nodes come struttura base (NON instance.data!)
  // ✅ IMPORTANTE: constraints/examples/nlpContract sono SEMPRE dal template, NON dall'istanza
  // ✅ L'istanza contiene solo steps clonati, constraints/examples vengono risolti dal template a compile-time
  const enrichedData = nodes.map((templateNode: TaskTreeNode) => {
    return {
      ...templateNode, // ✅ Struttura dal template (include templateId!)
      // ✅ Override dall'istanza (solo label)
      label: instance.label || templateNode.label,
      // ✅ Constraints/examples/nlpContract SEMPRE dal template (NO override)
      constraints: templateNode.constraints,
      examples: (templateNode as any).examples, // ✅ Esempi dal template se presenti
      nlpContract: (templateNode as any).nlpContract, // ✅ Contract dal template se presente
      // ✅ SubNodes viene dal template (già costruito da buildTaskTreeNodes)
      subNodes: templateNode.subNodes || []
    };
  });

  // ✅ ARCHITECTURAL RULE: Usa pipeline unificata per clonazione istanze
  // ✅ Usa steps dall'istanza (già clonati) o clona dal template (prima creazione)
  let finalRootSteps: Record<string, any> | undefined = undefined;
  let allGuidMappings = new Map<string, string>(templateGuidMapping);

  if (instance.steps && typeof instance.steps === 'object' && Object.keys(instance.steps).length > 0) {
    // ✅ Instance ha già steps clonati - usali
    finalRootSteps = instance.steps;
  } else if (template.steps && typeof template.steps === 'object' && Object.keys(template.steps).length > 0) {
    // ✅ ARCHITECTURAL RULE: Prima creazione - usa cloneTemplateSteps (pipeline unificata)
    // ✅ NON usare cloneStepsWithNewTaskIds direttamente - bypassa la pipeline
    const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(template, nodes);
    finalRootSteps = clonedSteps;
    // ✅ Unisci guidMapping con templateGuidMapping
    if (guidMapping && guidMapping.size > 0) {
      for (const [oldGuid, newGuid] of guidMapping.entries()) {
        allGuidMappings.set(oldGuid, newGuid);
      }
    }
  }

  const result = {
    label: instance.label ?? template.label,
    data: enrichedData, // ✅ Struttura ricostruita dal template (con templateId!)
    steps: finalRootSteps, // ✅ Steps dall'istanza o clonati
    // ✅ Constraints/nlpContract SEMPRE dal template (NO override dall'istanza)
    constraints: template.dataContracts ?? template.constraints ?? undefined,
    nlpContract: template.nlpContract ?? undefined
  };

  // ✅ ARCHITECTURAL RULE: Copy translations for cloned steps (only on first instance creation)
  const isFirstTimeCreation = !instance.steps || Object.keys(instance.steps).length === 0;
  if (isFirstTimeCreation && allGuidMappings.size > 0) {
    const templateId = template.id || template._id;
    if (templateId) {
      await copyTranslationsForClonedSteps(result, templateId, allGuidMappings);
    }
  }

  return result;
}

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
      // ✅ CRITICAL: Estrai i GUID delle traduzioni da parameters[].value (non solo task.id)
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
 * Convert template patterns to nlpContract structure
 * If template has patterns but no nlpContract, create nlpContract from patterns
 */
function convertPatternsToNlpContract(template: any): any | undefined {
  // If nlpContract already exists, use it
  if (template.nlpContract) {
    return template.nlpContract;
  }

  // If no patterns, return undefined
  if (!template.patterns || typeof template.patterns !== 'object') {
    return undefined;
  }

  // Convert patterns to nlpContract structure
  const templateId = template.id || template._id;
  const templateName = template.name || template.label || 'unknown';

  // Extract patterns by locale (IT, EN, PT) and flatten into single array
  const allPatterns: string[] = [];
  if (template.patterns.IT && Array.isArray(template.patterns.IT)) {
    allPatterns.push(...template.patterns.IT);
  }
  if (template.patterns.EN && Array.isArray(template.patterns.EN)) {
    allPatterns.push(...template.patterns.EN);
  }
  if (template.patterns.PT && Array.isArray(template.patterns.PT)) {
    allPatterns.push(...template.patterns.PT);
  }

  // If no patterns found, return undefined
  if (allPatterns.length === 0) {
    return undefined;
  }

  // Build nlpContract structure
  return {
    templateName,
    templateId,
    subDataMapping: {},
    regex: {
      patterns: allPatterns,
      testCases: []
    },
    rules: null,
    llm: null,
    ner: null
  };
}

// ❌ RIMOSSO: buildDataTree() duplicato - usa buildTaskTreeNodes() da taskUtils.ts
// ❌ RIMOSSO: buildDataFromTemplate() - deprecato, non più necessario

/**
 * Copy translations for cloned steps
 * Uses guidMapping to map old GUIDs (from template) to new GUIDs (in instance)
 * Loads translations for old GUIDs and saves them for new GUIDs
 */
export async function copyTranslationsForClonedSteps(_ddt: any, _templateId: string, guidMapping: Map<string, string>): Promise<void> {
  try {
    if (!guidMapping || guidMapping.size === 0) {
      console.log('[copyTranslationsForClonedSteps] ⚠️ No GUID mapping provided, skipping translation copy');
      return; // No mappings to process
    }

    console.log('[copyTranslationsForClonedSteps] 🔍 START - Analizzando mapping GUID', {
      guidMappingSize: guidMapping.size,
      templateId: _templateId
    });

    // Get old GUIDs (from template) - these have translations in the database
    const oldGuids = Array.from(guidMapping.keys());
    console.log('[copyTranslationsForClonedSteps] 📋 GUID mapping dettagliato', {
      totalMappings: guidMapping.size,
      sampleMappings: Array.from(guidMapping.entries()).slice(0, 5).map(([oldGuid, newGuid]) => ({
        oldGuid,
        newGuid
      }))
    });

    // ✅ FASE 2: Carica traduzioni template SOLO da memoria (ProjectTranslationsContext)
    // Durante la creazione del wizard, tutto è in memoria - NON cercare nel database
    const { getCurrentProjectLocale } = await import('./categoryPresets');
    const projectLocale = getCurrentProjectLocale() || 'it-IT';
    const templateTranslations: Record<string, string> = {};

    // ✅ PRIORITÀ 1: Cerca PRIMA in memoria (ProjectTranslationsContext)
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const context = (window as any).__projectTranslationsContext;
      const contextTranslations = context.translations || {};

      console.log('[copyTranslationsForClonedSteps] 🔍 Cercando traduzioni template in memoria', {
        oldGuidsCount: oldGuids.length,
        contextTranslationsCount: Object.keys(contextTranslations).length,
        oldGuids: Array.from(oldGuids).slice(0, 10),
        availableGuids: Object.keys(contextTranslations).slice(0, 20),
        projectLocale
      });

      for (const oldGuid of oldGuids) {
        const trans = contextTranslations[oldGuid];
        if (trans) {
          const text = typeof trans === 'object'
            ? (trans[projectLocale] || trans.en || trans.it || trans.pt || '')
            : String(trans);
          if (text) {
            templateTranslations[oldGuid] = text;
          }
        }
      }

      const matchingGuids = Array.from(oldGuids).filter(g => g in contextTranslations);
      const missingGuids = Array.from(oldGuids).filter(g => !(g in contextTranslations));

      console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni template trovate in memoria', {
        foundInMemory: Object.keys(templateTranslations).length,
        requested: oldGuids.length,
        matchingGuids: matchingGuids.slice(0, 10),
        missingGuids: missingGuids.slice(0, 10),
        sampleOldGuid: Array.from(oldGuids)[0],
        hasSampleInContext: Array.from(oldGuids)[0] ? (Array.from(oldGuids)[0] in contextTranslations) : false,
        sampleTranslation: Array.from(oldGuids)[0] ? contextTranslations[Array.from(oldGuids)[0]] : undefined
      });

      // ✅ DEBUG: Verifica dettagliata se le traduzioni Factory sono caricate
      console.log('[copyTranslationsForClonedSteps] 🔍 VERIFICA TRADUZIONI TEMPLATE', {
        templateId: _templateId,
        oldGuidsRequested: oldGuids.length,
        translationsFound: Object.keys(templateTranslations).length,
        contextTranslationsTotal: Object.keys(contextTranslations).length,
        // ✅ DEBUG: Verifica se i vecchi GUID del template sono presenti nelle traduzioni Factory
        sampleOldGuid: oldGuids[0],
        hasSampleInContext: oldGuids[0] ? (oldGuids[0] in contextTranslations) : false,
        // ✅ DEBUG: Verifica se ci sono traduzioni Factory caricate
        factoryTranslationsSample: Object.keys(contextTranslations).slice(0, 10),
        // ✅ DEBUG: Verifica se i vecchi GUID corrispondono a quelli nelle traduzioni Factory
        oldGuidsInContext: oldGuids.filter(g => g in contextTranslations).length,
        oldGuidsNotInContext: oldGuids.filter(g => !(g in contextTranslations)).length,
        // ✅ DEBUG: Mostra alcuni vecchi GUID che non sono stati trovati
        missingOldGuidsSample: oldGuids.filter(g => !(g in contextTranslations)).slice(0, 5)
      });
    }

    // ✅ PRIORITÀ 2: Se mancano traduzioni, cerca nel database (backward compatibility)
    const missingGuids = oldGuids.filter(g => !templateTranslations[g]);
    if (missingGuids.length > 0) {
      console.log('[copyTranslationsForClonedSteps] 🔍 Cercando traduzioni mancanti nel database', {
        missingCount: missingGuids.length,
        missingGuids: missingGuids.slice(0, 5)
      });

      try {
        const { getTemplateTranslations } = await import('../services/ProjectDataService');
        const dbTranslations = await getTemplateTranslations(missingGuids);

        for (const oldGuid of missingGuids) {
          const trans = dbTranslations[oldGuid];
          if (trans) {
            const text = typeof trans === 'object'
              ? (trans[projectLocale] || trans.en || trans.it || trans.pt || '')
              : String(trans);
            if (text) {
              templateTranslations[oldGuid] = text;
            }
          }
        }

        console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni template trovate nel database', {
          foundInDb: Object.keys(templateTranslations).length - (oldGuids.length - missingGuids.length),
          missingBefore: missingGuids.length,
          dbTranslationsKeys: Object.keys(dbTranslations).slice(0, 10),
          dbTranslationsCount: Object.keys(dbTranslations).length,
          sampleDbTranslation: Object.keys(dbTranslations).length > 0 ? {
            guid: Object.keys(dbTranslations)[0],
            value: dbTranslations[Object.keys(dbTranslations)[0]]
          } : undefined
        });
      } catch (err) {
        console.warn('[copyTranslationsForClonedSteps] ⚠️ Errore cercando traduzioni nel database (continua con quelle in memoria)', {
          error: err instanceof Error ? err.message : String(err),
          missingGuidsCount: missingGuids.length,
          foundInMemory: Object.keys(templateTranslations).length
        });
      }
    }

    console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni template caricate (finale)', {
      requestedCount: oldGuids.length,
      foundCount: Object.keys(templateTranslations).length,
      foundGuids: Object.keys(templateTranslations).slice(0, 10),
      missingGuids: oldGuids.filter(g => !templateTranslations[g]).slice(0, 10)
    });

    // ✅ projectLocale già definito sopra (linea 679)
    // Build translations dictionary for instance (NEW GUIDs -> text from template)
    // Map: oldGuid -> newGuid -> text
    const instanceTranslations: Record<string, string> = {};
    const copiedCount = { success: 0, skipped: 0, failed: 0 };

    for (const oldGuid of oldGuids) {
      const newGuid = guidMapping.get(oldGuid);
      if (!newGuid) {
        console.warn('[copyTranslationsForClonedSteps] ⚠️ GUID mapping incompleto', { oldGuid, newGuid });
        copiedCount.failed++;
        continue;
      }

      const templateTrans = templateTranslations[oldGuid];
      if (templateTrans) {
        // Extract text for project locale
        const text = typeof templateTrans === 'object'
          ? (templateTrans[projectLocale] || templateTrans.en || templateTrans.it || templateTrans.pt || '')
          : String(templateTrans);

        if (text) {
          instanceTranslations[newGuid] = text; // ✅ Use NEW GUID as key
          copiedCount.success++;
          console.log('[copyTranslationsForClonedSteps] ✅ Copiata traduzione', {
            oldGuid,
            newGuid,
            textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            locale: projectLocale
          });
        } else {
          console.warn('[copyTranslationsForClonedSteps] ⚠️ Traduzione template vuota', { oldGuid, newGuid, templateTrans });
          copiedCount.skipped++;
        }
      } else {
        console.warn('[copyTranslationsForClonedSteps] ⚠️ Traduzione template non trovata', { oldGuid, newGuid });
        copiedCount.skipped++;
      }
    }

    console.log('[copyTranslationsForClonedSteps] 📊 Riepilogo copia traduzioni', {
      total: guidMapping.size,
      success: copiedCount.success,
      skipped: copiedCount.skipped,
      failed: copiedCount.failed,
      instanceTranslationsCount: Object.keys(instanceTranslations).length
    });

    // Add translations to global table via window context (in memory) AND save to database
    if (Object.keys(instanceTranslations).length > 0) {
      console.log('[copyTranslationsForClonedSteps] ✅ Copiando traduzioni per istanza', {
        translationsCount: Object.keys(instanceTranslations).length,
        guidMappingSize: guidMapping.size,
        oldGuidsCount: oldGuids.length,
        templateTranslationsFound: Object.keys(templateTranslations).length,
        sampleGuids: Object.keys(instanceTranslations).slice(0, 5),
        sampleTexts: Object.entries(instanceTranslations).slice(0, 3).map(([guid, text]) => ({
          guid,
          textPreview: text.substring(0, 50) + '...'
        })),
        // ✅ DEBUG: Verifica se ci sono GUID nel mapping senza traduzioni
        missingTranslations: oldGuids.filter(oldGuid => !templateTranslations[oldGuid]).slice(0, 5)
      });

      // Try to add to in-memory context first
      const translationsContext = (window as any).__projectTranslationsContext;
      if (translationsContext && translationsContext.addTranslations) {
        console.log('[copyTranslationsForClonedSteps] 🔍 Aggiungendo traduzioni al context in memoria', {
          translationsToAdd: Object.keys(instanceTranslations).length,
          sampleNewGuids: Object.keys(instanceTranslations).slice(0, 5)
        });
        translationsContext.addTranslations(instanceTranslations);
        console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni aggiunte al context in memoria', {
          addedCount: Object.keys(instanceTranslations).length,
          // ✅ Verifica che siano state aggiunte
          verification: Object.keys(instanceTranslations).slice(0, 3).map(guid => ({
            guid,
            inContext: guid in (translationsContext.translations || {})
          }))
        });

        // ✅ DEBUG: Verifica dettagliata che le traduzioni siano state aggiunte correttamente
        console.log('[copyTranslationsForClonedSteps] 🔍 VERIFICA POST-COPIA', {
          translationsAdded: Object.keys(instanceTranslations).length,
          newGuidsAdded: Object.keys(instanceTranslations).slice(0, 5),
          contextTotalAfterAdd: Object.keys(translationsContext.translations || {}).length,
          // ✅ Verifica che i nuovi GUID siano effettivamente nel context
          sampleNewGuid: Object.keys(instanceTranslations)[0],
          sampleNewGuidInContext: Object.keys(instanceTranslations)[0] ? (Object.keys(instanceTranslations)[0] in (translationsContext.translations || {})) : false,
          sampleNewGuidTranslation: Object.keys(instanceTranslations)[0] ? (translationsContext.translations || {})[Object.keys(instanceTranslations)[0]] : undefined
        });
      } else {
        console.warn('[copyTranslationsForClonedSteps] ⚠️ ProjectTranslationsContext not available, will save to DB only', {
          hasWindow: typeof window !== 'undefined',
          hasContext: typeof window !== 'undefined' && !!(window as any).__projectTranslationsContext,
          hasAddTranslations: typeof window !== 'undefined' && !!(window as any).__projectTranslationsContext?.addTranslations
        });
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
          // ✅ projectLocale già definito sopra (linea 679)

          const translationsToSave = Object.entries(instanceTranslations).map(([guid, text]) => ({
            guid,
            language: projectLocale,
            text: text as string,
            type: 'Instance'
          }));

          console.log('[copyTranslationsForClonedSteps] 💾 Salvando traduzioni nel database', {
            projectId,
            translationsToSaveCount: translationsToSave.length,
            sampleTranslations: translationsToSave.slice(0, 3).map(t => ({
              guid: t.guid,
              language: t.language,
              textPreview: t.text.substring(0, 50) + (t.text.length > 50 ? '...' : '')
            }))
          });

          await saveProjectTranslations(projectId, translationsToSave);
          console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni salvate nel database', {
            savedCount: translationsToSave.length
          });

          // ✅ Reload translations in context if available (to ensure UI sees the new translations)
          const translationsContext = (window as any).__projectTranslationsContext;
          if (translationsContext && translationsContext.loadAllTranslations) {
            console.log('[copyTranslationsForClonedSteps] 🔄 Ricaricando traduzioni nel context');
            try {
              await translationsContext.loadAllTranslations();
              console.log('[copyTranslationsForClonedSteps] ✅ Traduzioni ricaricate nel context');
            } catch (reloadErr) {
              console.warn('[copyTranslationsForClonedSteps] ⚠️ Failed to reload translations in context:', reloadErr);
            }
          } else {
            console.warn('[copyTranslationsForClonedSteps] ⚠️ Context non disponibile per reload', {
              hasContext: !!translationsContext,
              hasLoadAllTranslations: !!translationsContext?.loadAllTranslations
            });
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
// Queste funzioni non sono più necessarie perché loadDDTFromTemplate
// ora ricostruisce sempre l'albero da templateId usando buildDataTree,
// invece di iterare su instance.data




/**
 * Check if data contracts (constraints/examples/nlpContract) have been modified in instance
 * Returns true if instance has overrides (data contracts are present in instance)
 */
export function hasDataContractOverrides(instance: Task | null): boolean {
  if (!instance) return false;

  // Check root level
  if (instance.constraints || instance.nlpContract) {
    return true;
  }

  // Check data nodes
  if (instance.data && Array.isArray(instance.data)) {
    for (const mainNode of instance.data) {
      if (mainNode.constraints || mainNode.nlpContract) {
        return true;
      }
      // Check subData nodes
      if (mainNode.subTasks && Array.isArray(mainNode.subTasks)) {
        for (const subNode of mainNode.subTasks) {
          if (subNode.constraints || subNode.nlpContract) {
            return true;
          }
        }
      }
    }
  }

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
 * Extract only modified fields from DDT (compared to template)
 *
 * LOGICA CORRETTA:
 * - Il template definisce SOLO la struttura dei dati (data, subData, dataId, semantica)
 * - L'istanza definisce la logica (step, escalation, constraints, examples, nlpContract)
 * - Se la struttura è identica → salva solo override (logica)
 * - Se la struttura è diversa → salva tutto (derivazione rotta, diventa standalone)
 *
 * VANTAGGI:
 * - Elimina duplicazione: stessa struttura salvata N volte per N istanze
 * - Override legittimi: step/escalation possono divergere senza rompere derivazione
 * - Performance: meno dati nel database, lookup template in memoria (O(1))
 */
export async function extractModifiedTaskTreeFields(instance: Task | null, localTaskTree: any): Promise<Partial<Task>> {
  if (!instance || !localTaskTree) {
    return localTaskTree || {};
  }

  // ✅ Se no templateId, questo è un template o istanza standalone → salva tutto
  if (!instance.templateId) {
    return {
      label: localTaskTree.label,
      data: localTaskTree.data,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localTaskTree.constraints,
      nlpContract: localTaskTree.nlpContract,
      introduction: localTaskTree.introduction
    };
  }

  // ✅ Carica template per confronto
  const template = DialogueTaskService.getTemplate(instance.templateId);
  if (!template) {
    // ❌ Template non trovato → salva tutto (non può risolvere lazy)
    console.warn(`[extractModifiedTaskTreeFields] Template ${instance.templateId} not found - saving everything (cannot resolve lazy)`);
    return {
      label: localTaskTree.label,
      data: localTaskTree.data,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localTaskTree.constraints,
      nlpContract: localTaskTree.nlpContract,
      introduction: localTaskTree.introduction
    };
  }

  // ✅ Salva sempre label (sempre modificabile)
  const result: Partial<Task> = {
    label: localTaskTree.label,
    steps: {} // ✅ CORRETTO: Inizializza steps a root level (unica fonte di verità)
  };

  // ✅ Confronta SOLO la struttura dei dati (senza step, constraints, etc.)
  // Usa template.data direttamente (non buildDataFromTemplate che clona già gli step)
  // Oppure costruisci struttura base da subDataIds se template composito
  let templateStructureForCompare: any[] = [];

  if (template.data && Array.isArray(template.data) && template.data.length > 0) {
    // Template ha data: usa direttamente (senza step, constraints, etc.)
    templateStructureForCompare = template.data.map((main: any) => ({
      id: main.id,
      label: main.label,
      type: main.type,
      templateId: main.templateId,
      subData: (main.subTasks || []).map((sub: any) => ({
        templateId: sub.templateId,
        label: sub.label
      }))
    }));
  } else if (template.subTasksIds && Array.isArray(template.subTasksIds) && template.subTasksIds.length > 0) {
    // Template composito: costruisci struttura base (solo id, label, type, subData con templateId)
    templateStructureForCompare = [{
      id: template.id || template._id,
      label: template.label || template.name || 'Data',
      type: template.type,
      templateId: template.id || template._id,
      subData: template.subTasksIds.map((subId: string) => {
        const subTemplate = DialogueTaskService.getTemplate(subId);
        if (subTemplate) {
          return {
            templateId: subTemplate.id || subTemplate._id,
            label: subTemplate.label || subTemplate.name || 'Sub'
          };
        }
        return { templateId: subId, label: 'Sub' };
      })
    }];
  }

  // ✅ Normalizza localTaskTree.data per confronto (solo struttura, senza step, constraints, etc.)
  const localStructureForCompare = (localTaskTree.data || []).map((main: any) => ({
    id: main.id,
    label: main.label,
    type: main.type,
    templateId: main.templateId,
    subData: (main.subTasks || []).map((sub: any) => ({
      templateId: sub.templateId,
      label: sub.label
    }))
  }));

  console.log('[extractModifiedTaskTreeFields] 🔍 Comparing structure', {
    localdataLength: localTaskTree.data?.length || 0,
    templateDataLength: templateStructureForCompare.length,
    localStructure: JSON.stringify(localStructureForCompare, null, 2).substring(0, 500),
    templateStructure: JSON.stringify(templateStructureForCompare, null, 2).substring(0, 500)
  });

  const structureIdentical = compareDataStructure(
    localStructureForCompare,
    templateStructureForCompare
  );

  console.log('[extractModifiedTaskTreeFields] ✅ Structure comparison result', {
    structureIdentical,
    localdataLength: localTaskTree.data?.length || 0
  });

  if (!structureIdentical) {
    // ✅ Struttura diversa → derivazione rotta → salva tutto (diventa standalone)
    console.log('[extractModifiedTaskTreeFields] ⚠️ Structure changed - saving full data (derivation broken)', {
      localdataLength: localTaskTree.data?.length || 0,
      templateDataLength: templateStructureForCompare.length
    });
    return {
      label: localTaskTree.label,
      data: localTaskTree.data, // ✅ Salva struttura completa
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localTaskTree.constraints,
      nlpContract: localTaskTree.nlpContract,
      introduction: localTaskTree.introduction
    };
  }

  // ✅ Struttura identica → salva solo override (logica: steps, constraints, examples, nlpContract)
  // Usa buildTaskTreeNodes per ottenere templateNode con constraints/examples per confronto override
  const templateNodesForOverride = buildTaskTreeNodes(template);

  console.log('[extractModifiedTaskTreeFields] ✅ Structure identical - extracting overrides only', {
    localNodesLength: localTaskTree.nodes?.length || 0,
    templateNodesForOverrideLength: templateNodesForOverride.length
  });

  // ✅ NUOVO MODELLO: Usa nodes[] invece di data[]
  const localNodes = localTaskTree.nodes || localTaskTree.data || []; // Fallback per compatibilità temporanea
  if (Array.isArray(localNodes) && localNodes.length > 0 && templateNodesForOverride.length > 0) {
    const dataOverrides: any[] = [];

    for (let i = 0; i < localNodes.length; i++) {
      const mainNode = localNodes[i];
      const templateNode = templateNodesForOverride[i] || templateNodesForOverride[0]; // Fallback to first

      const templateNodeConstraints = templateNode?.dataContracts || templateNode?.constraints || [];
      const templateNodeNlpContract = templateNode?.nlpContract;

      // ✅ CRITICAL: Leggi steps usando templateId come chiave (non id)
      // task.steps[node.templateId] = steps clonati
      if (!mainNode.templateId) {
        const errorMsg = `[extractModifiedTaskTreeFields] Nodo senza templateId: ${mainNode.label || mainNode.id || 'unknown'}`;
        console.error(errorMsg, { mainNode });
        throw new Error(errorMsg);
      }
      const nodeTemplateId = mainNode.templateId;
      const nodeSteps = nodeTemplateId && instance.steps ? instance.steps[nodeTemplateId] : null;
      const hasSteps = nodeSteps && (
        (Array.isArray(nodeSteps) && nodeSteps.length > 0) ||
        (typeof nodeSteps === 'object' && Object.keys(nodeSteps).length > 0)
      );
      const hasConstraintsOverride = JSON.stringify(mainNode.constraints || []) !== JSON.stringify(templateNodeConstraints);
      const hasNlpContractOverride = JSON.stringify(mainNode.nlpContract) !== JSON.stringify(templateNodeNlpContract);

      console.log('[extractModifiedTaskTreeFields] 🔍 Checking overrides for mainNode', {
        mainNodeIndex: i,
        mainNodeId: mainNode.id,
        mainNodeTemplateId: nodeTemplateId,
        hasSteps,
        hasConstraintsOverride,
        hasNlpContractOverride,
        stepsType: typeof nodeSteps,
        stepsIsArray: Array.isArray(nodeSteps),
        stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
        stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
      });

      if (hasSteps || hasConstraintsOverride || hasNlpContractOverride) {
        const overrideNode: any = {
          templateId: mainNode.templateId || templateNode.templateId,
          label: mainNode.label
        };

        // ✅ CRITICAL: Salva steps come array MaterializedStep[]
        // ✅ NUOVO: steps è un array, non un dictionary
        if (hasSteps && nodeTemplateId) {
          // ✅ Inizializza result.steps come array se non esiste
          if (!result.steps) result.steps = [];

          // ✅ Converti nodeSteps in MaterializedStep[] se necessario
          const materializedSteps: MaterializedStep[] = Array.isArray(nodeSteps)
            ? nodeSteps
            : [];  // ✅ Se non è array, inizializza vuoto (legacy format)

          // ✅ Aggiungi steps all'array (non sovrascrivere, ma unire)
          result.steps = [...(result.steps as MaterializedStep[]), ...materializedSteps];

          console.log('[extractModifiedTaskTreeFields] ✅ Including steps in override', {
            mainNodeIndex: i,
            nodeId: mainNode.id,
            nodeTemplateId,
            stepsType: typeof nodeSteps,
            stepsIsArray: Array.isArray(nodeSteps),
            stepsLength: materializedSteps.length,
            totalStepsCount: (result.steps as MaterializedStep[]).length
          });
        }
        if (hasConstraintsOverride) overrideNode.constraints = mainNode.constraints;
        if (hasNlpContractOverride) overrideNode.nlpContract = mainNode.nlpContract;

        // ✅ NUOVO MODELLO: Check subNodes overrides (solo logica, non struttura)
        const mainSubNodes = mainNode.subNodes || mainNode.subTasks || []; // Fallback per compatibilità
        const templateSubNodes = templateNode.subNodes || [];
        if (Array.isArray(mainSubNodes) && mainSubNodes.length > 0 && templateSubNodes.length > 0) {
          const subDataOverrides: any[] = [];
          for (const subNode of mainSubNodes) {
            const templateSubNode = templateSubNodes.find((s: TaskTreeNode) =>
              s.templateId === subNode.templateId || s.label === subNode.label
            );

            if (templateSubNode) {
              const templateSubConstraints = templateSubNode.dataContracts || templateSubNode.constraints || [];
              const templateSubExamples = templateSubNode.examples || [];
              const templateSubNlpContract = templateSubNode.nlpContract;

              // ✅ CORRETTO: Leggi steps da instance.steps[subNodeId], NON da subNode.steps
              const subNodeId = subNode.id;
              const subNodeSteps = subNodeId && instance.steps ? instance.steps[subNodeId] : null;
              const hasSubSteps = subNodeSteps && (
                (Array.isArray(subNodeSteps) && subNodeSteps.length > 0) ||
                (typeof subNodeSteps === 'object' && Object.keys(subNodeSteps).length > 0)
              );
              const hasSubConstraintsOverride = JSON.stringify(subNode.constraints || []) !== JSON.stringify(templateSubConstraints);
              const hasSubExamplesOverride = JSON.stringify(subNode.examples || []) !== JSON.stringify(templateSubExamples);
              const hasSubNlpContractOverride = JSON.stringify(subNode.nlpContract) !== JSON.stringify(templateSubNlpContract);

              if (hasSubSteps || hasSubConstraintsOverride || hasSubExamplesOverride || hasSubNlpContractOverride) {
                if (!subNode.templateId && !templateSubNode.templateId) {
                  const errorMsg = `[extractModifiedTaskTreeFields] Sub-nodo senza templateId: ${subNode.label || subNode.id || 'unknown'}`;
                  console.error(errorMsg, { subNode, templateSubNode });
                  throw new Error(errorMsg);
                }
                const overrideSubNode: any = {
                  templateId: subNode.templateId || templateSubNode.templateId,
                  label: subNode.label
                };

                // ✅ CORRETTO: Salva steps in result.steps[subNodeId] a root level, NON in overrideSubNode.steps
                if (hasSubSteps && subNodeId) {
                  if (!result.steps) result.steps = {};
                  result.steps[subNodeId] = subNodeSteps;
                }
                if (hasSubConstraintsOverride) overrideSubNode.constraints = subNode.constraints;
                if (hasSubNlpContractOverride) overrideSubNode.nlpContract = subNode.nlpContract;

                subDataOverrides.push(overrideSubNode);
              }
            }
          }
          if (subDataOverrides.length > 0) {
            overrideNode.subNodes = subDataOverrides; // ✅ NUOVO MODELLO: subNodes invece di subTasks
          }
        }

        dataOverrides.push(overrideNode);
      }
    }

    if (dataOverrides.length > 0) {
      // ✅ NUOVO MODELLO: Non salvare più .data, salva solo override necessari
      // result.data è deprecato - gli override vengono salvati in result.steps e altri campi
      console.log('[extractModifiedTaskTreeFields] ✅ Saving data overrides', {
        dataOverridesLength: dataOverrides.length,
        firstOverride: dataOverrides[0] ? {
          templateId: dataOverrides[0].templateId,
          label: dataOverrides[0].label,
          hasSteps: !!dataOverrides[0].steps,
          stepsType: typeof dataOverrides[0].steps,
          stepsKeys: typeof dataOverrides[0].steps === 'object' ? Object.keys(dataOverrides[0].steps || {}) : []
        } : null
      });
    } else {
      console.log('[extractModifiedTaskTreeFields] ⚠️ No data overrides found - saving empty data array');
    }
  }

  // ✅ Confronta root-level constraints/nlpContract/introduction
  // Salva solo se diversi dal template (override)
  const templateConstraints = template.dataContracts || template.constraints || [];
  const templateNlpContract = template.nlpContract;
  const templateIntroduction = template.introduction;

  if (JSON.stringify(localTaskTree.constraints || []) !== JSON.stringify(templateConstraints)) {
    result.constraints = localTaskTree.constraints;
  }

  if (JSON.stringify(localTaskTree.nlpContract) !== JSON.stringify(templateNlpContract)) {
    result.nlpContract = localTaskTree.nlpContract;
  }

  if (localTaskTree.introduction !== templateIntroduction) {
    result.introduction = localTaskTree.introduction;
  }

  console.log('[extractModifiedTaskTreeFields] ✅ Final result', {
    hasLabel: !!result.label,
    hasdata: !!result.data,
    dataLength: result.data?.length || 0,
    hasConstraints: !!result.constraints,
    hasNlpContract: !!result.nlpContract,
    hasIntroduction: !!result.introduction,
    resultKeys: Object.keys(result)
  });

  return result;
}

