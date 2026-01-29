import type { Task } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
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
export async function buildDDTFromTask(instance: Task | null): Promise<any | null> {
  if (!instance) return null;

  // If no templateId or templateId is "UNDEFINED", this is a standalone instance (has full structure)
  // "UNDEFINED" is a placeholder for tasks that haven't been typed yet, not a real template
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    return {
      label: instance.label,
      data: instance.data || [],
      steps: instance.steps,  // ✅ Steps a root level (già nel formato corretto)
      constraints: instance.constraints
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
      constraints: instance.constraints
    };
  }

  // ✅ CRITICAL: Ricostruisci SEMPRE l'albero dal template (NON usare instance.data!)
  const dataTree = buildDataTree(template);
  // ✅ dataTree contiene:
  // - Tutti i nodi principali con templateId corretti
  // - Tutti i subData dereferenziati con templateId corretti
  // - Struttura completa del template

  // ✅ Clone steps usando dataTree (albero montato con templateId corretti)
  const { guidMapping: templateGuidMapping } = cloneTemplateSteps(template, dataTree);

  // ✅ Usa dataTree come struttura base (NON instance.data!)
  // ✅ IMPORTANTE: constraints/examples/nlpContract sono SEMPRE dal template, NON dall'istanza
  // ✅ L'istanza contiene solo steps clonati, constraints/examples vengono risolti dal template a compile-time
  const enrichedData = dataTree.map((templateNode: any) => {
    return {
      ...templateNode, // ✅ Struttura dal template (include templateId!)
      // ✅ Override dall'istanza (solo label)
      label: instance.label || templateNode.label,
      // ✅ Constraints/nlpContract SEMPRE dal template (NO override)
      constraints: templateNode.constraints,
      dataContract: templateNode.dataContract,
      // ✅ SubTasks viene dal template (già costruito da buildDataTree - Task template references)
      // ✅ Map to subData for compatibility with existing DDT structure
      subData: templateNode.subTasks || []
    };
  });

  // ✅ Usa steps dall'istanza (già clonati) o clona dal template (prima creazione)
  let finalRootSteps: Record<string, any> | undefined = undefined;

  if (instance.steps && typeof instance.steps === 'object' && Object.keys(instance.steps).length > 0) {
    // ✅ Instance ha già steps clonati - usali
    finalRootSteps = instance.steps;
  } else if (template.steps && typeof template.steps === 'object' && Object.keys(template.steps).length > 0) {
    // ✅ Prima creazione - clona steps dal template
    finalRootSteps = {};
    for (const [nodeId, templateSteps] of Object.entries(template.steps)) {
      if (templateSteps && typeof templateSteps === 'object') {
        const { cloned } = cloneStepsWithNewTaskIds(templateSteps as any);
        finalRootSteps[nodeId] = cloned;
      }
    }
  }

  const result = {
    label: instance.label ?? template.label,
    data: enrichedData, // ✅ Struttura ricostruita dal template (con templateId!)
    steps: finalRootSteps, // ✅ Steps dall'istanza o clonati
    // ✅ Constraints/nlpContract SEMPRE dal template (NO override dall'istanza)
    constraints: template.dataContracts ?? template.constraints ?? undefined,
    dataContract: template.dataContract ?? undefined
  };

  // ✅ Copy translations for cloned steps (only on first instance creation)
  const isFirstTimeCreation = !instance.steps || Object.keys(instance.steps).length === 0;
  if (isFirstTimeCreation) {
    const templateId = template.id || template._id;
    if (templateId) {
      const allGuidMappings = new Map<string, string>(templateGuidMapping);
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
 * Build data tree from template (dereference subTasks)
 * Returns only data structure (without steps)
 * ✅ NON inventa label: se manca, logga warning e lascia undefined
 */
export function buildDataTree(template: any): any[] {
  // Helper function to recursively dereference subTasks
  const dereferenceSubData = (subNode: any): any => {
    const subNodeId = subNode.id;
    if (!subNodeId) {
      return subNode;
    }

    // ✅ SEMPRE: subNode contiene solo { id } → carica task atomico completo
    const subTemplate = DialogueTaskService.getTemplate(subNodeId);
    if (!subTemplate) {
      console.warn('[buildDataTree] Sub-template not found:', subNodeId);
      return subNode;
    }

    // ✅ Recursively dereference subTasks (support for arbitrary depth)
    const dereferencedSubData = (subTemplate.data && Array.isArray(subTemplate.data) && subTemplate.data.length > 0 && subTemplate.data[0].subTasks)
      ? (subTemplate.data[0].subTasks || []).map(dereferenceSubData)
      : [];

    // ✅ Costruisci struttura completa dal task atomico - SOLO templateId (referenceId eliminato)
    return {
      id: subTemplate.id || subTemplate._id,
      label: subTemplate.label, // ✅ NON inventare: se manca, sarà undefined
      type: subTemplate.type,
      icon: subTemplate.icon || 'FileText',
      constraints: subTemplate.dataContracts || subTemplate.constraints || [],
      dataContract: subTemplate.dataContract || undefined,
      subTasks: dereferencedSubData, // ✅ Supporta profondità arbitraria
      templateId: subTemplate.id || subTemplate._id, // ✅ Solo templateId (uguale a id per template atomici/compositi)
      kind: subTemplate.name || subTemplate.type || 'generic'
    };
  };

  // ✅ Check if template has data structure
  if (template.data && Array.isArray(template.data) && template.data.length > 0) {
    // Template has data - dereference structure
    const data = template.data.map((mainNode: any) => {
      // ✅ Process subTasks recursively (support for arbitrary depth)
      const subData = (mainNode.subTasks || []).map(dereferenceSubData);

      // ✅ NON inventare label: se manca, logga warning
      if (!mainNode.label && !template.label && !template.name) {
        const labelForHeuristics = template.id || 'UNKNOWN';
        console.warn('[buildDataTree] Label mancante nel template, uso ID come fallback tecnico per euristiche', {
          templateId: template.id,
          fallbackLabel: labelForHeuristics,
          nodeId: mainNode.id
        });
      }

      // ✅ CRITICAL: Determina templateId corretto
      // Se template.data.length === 1 → dato principale → templateId = template.id
      // Se template.data.length > 1 → template aggregato → ogni mainNode è un template referenziato → templateId = mainNode.id
      const isAggregateTemplate = template.data.length > 1;
      const nodeTemplateId = isAggregateTemplate
        ? (mainNode.id || mainNode.templateId)  // ✅ Template aggregato: usa mainNode.id
        : (template.id || template._id);        // ✅ Template atomico/composito: usa template.id

      // ✅ CRITICAL: Copia dataContracts dal template se mainNode non li ha
      // ✅ I dataContracts sono referenziati dal template, NON copiati nell'istanza
      const nodeConstraints = mainNode.constraints || mainNode.dataContracts || template.dataContracts || template.constraints || [];

      console.log('[🔍 buildDataTree] Main node constraints and contract', {
        nodeLabel: mainNode.label || template.label,
        nodeTemplateId: nodeTemplateId,
        mainNodeHasConstraints: !!(mainNode.constraints && mainNode.constraints.length > 0),
        mainNodeHasDataContracts: !!(mainNode.dataContracts && mainNode.dataContracts.length > 0),
        templateHasDataContracts: !!(template.dataContracts && template.dataContracts.length > 0),
        templateHasConstraints: !!(template.constraints && template.constraints.length > 0),
        finalConstraints: nodeConstraints ? `Array(${nodeConstraints.length})` : 'undefined',
        mainNodeHasDataContract: !!mainNode.dataContract,
        templateHasDataContract: !!template.dataContract,
        templateDataContractContractsCount: template.dataContract?.contracts?.length || 0,
        finalDataContract: mainNode.dataContract || template.dataContract ? 'present' : 'undefined'
      });

      return {
        ...mainNode,
        id: mainNode.id || template.id || template._id, // ✅ Preserva id esistente o usa template.id
        templateId: mainNode.templateId || nodeTemplateId, // ✅ CRITICAL: Imposta esplicitamente templateId
        label: mainNode.label || template.label || template.name || undefined, // ✅ NON inventare: undefined se manca
        constraints: nodeConstraints, // ✅ CRITICAL: Copia dataContracts dal template (referenza)
        dataContract: mainNode.dataContract || template.dataContract || undefined, // ✅ CRITICAL: Copia dataContract dal template
        subTasks: subData
      };
    });

    return data;
  }

  // ✅ Build from subDataIds (composite template)
  const subDataIds = template.subTasksIds || [];
  if (subDataIds.length > 0) {
    const subDataInstances: any[] = [];
    for (const subId of subDataIds) {
      const subTemplate = DialogueTaskService.getTemplate(subId);
      if (subTemplate) {
        // ✅ Recursively dereference subTasks
        const dereferencedSubData = (subTemplate.data && Array.isArray(subTemplate.data) && subTemplate.data.length > 0 && subTemplate.data[0].subTasks)
          ? (subTemplate.data[0].subTasks || []).map(dereferenceSubData)
          : [];

        subDataInstances.push({
          id: subTemplate.id || subTemplate._id,
          label: subTemplate.label, // ✅ NON inventare
          type: subTemplate.type,
          icon: subTemplate.icon || 'FileText',
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          dataContract: subTemplate.dataContract || undefined,
          subTasks: dereferencedSubData,
          templateId: subTemplate.id || subTemplate._id, // ✅ Solo templateId (uguale a id per template atomici/compositi)
          kind: subTemplate.name || subTemplate.type || 'generic'
        });
      }
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
export async function extractModifiedDDTFields(instance: Task | null, localDDT: any): Promise<Partial<Task>> {
  if (!instance || !localDDT) {
    return localDDT || {};
  }

  // ✅ Se no templateId, questo è un template o istanza standalone → salva tutto
  if (!instance.templateId) {
    return {
      label: localDDT.label,
      data: localDDT.data,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      // ❌ RIMOSSO: dataContract non è più override, è sempre nel template
      introduction: localDDT.introduction
    };
  }

  // ✅ Carica template per confronto
  const template = DialogueTaskService.getTemplate(instance.templateId);
  if (!template) {
    // ❌ Template non trovato → salva tutto (non può risolvere lazy)
    console.warn(`[extractModifiedDDTFields] Template ${instance.templateId} not found - saving everything (cannot resolve lazy)`);
    return {
      label: localDDT.label,
      data: localDDT.data,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      // ❌ RIMOSSO: dataContract non è più override, è sempre nel template
      introduction: localDDT.introduction
    };
  }

  // ✅ Salva sempre label (sempre modificabile)
  const result: Partial<Task> = {
    label: localDDT.label,
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

  // ✅ Normalizza localDDT.data per confronto (solo struttura, senza step, constraints, etc.)
  const localStructureForCompare = (localDDT.data || []).map((main: any) => ({
    id: main.id,
    label: main.label,
    type: main.type,
    templateId: main.templateId,
    subData: (main.subTasks || []).map((sub: any) => ({
      templateId: sub.templateId,
      label: sub.label
    }))
  }));

  const structureIdentical = compareDataStructure(
    localStructureForCompare,
    templateStructureForCompare
  );

  if (!structureIdentical) {
    // ✅ Struttura diversa → derivazione rotta → salva tutto (diventa standalone)
    return {
      label: localDDT.label,
      data: localDDT.data, // ✅ Salva struttura completa
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      // ❌ RIMOSSO: dataContract non è più override, è sempre nel template
      introduction: localDDT.introduction
    };
  }

  // ✅ Struttura identica → salva solo override (logica: steps, constraints, examples, nlpContract)
  // Usa buildDataTree per ottenere templateNode con constraints/examples per confronto override
  const templateDataForOverride = buildDataTree(template);

  console.log('[extractModifiedDDTFields] ✅ Structure identical - extracting overrides only', {
    localdataLength: localDDT.data?.length || 0,
    templateDataForOverrideLength: templateDataForOverride.length
  });

  if (localDDT.data && Array.isArray(localDDT.data) && templateDataForOverride.length > 0) {
    const dataOverrides: any[] = [];

    for (let i = 0; i < localDDT.data.length; i++) {
      const mainNode = localDDT.data[i];
      const templateNode = templateDataForOverride[i] || templateDataForOverride[0]; // Fallback to first

      // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
      // Variables removed - not needed since we don't check for overrides

      // ✅ CRITICAL: Leggi steps usando templateId come chiave (non id)
      // task.steps[node.templateId] = steps clonati
      if (!mainNode.templateId) {
        const errorMsg = `[extractModifiedDDTFields] Nodo senza templateId: ${mainNode.label || mainNode.id || 'unknown'}`;
        console.error(errorMsg, { mainNode });
        throw new Error(errorMsg);
      }
      const nodeTemplateId = mainNode.templateId;
      const nodeSteps = nodeTemplateId && instance.steps ? instance.steps[nodeTemplateId] : null;
      const hasSteps = nodeSteps && (
        (Array.isArray(nodeSteps) && nodeSteps.length > 0) ||
        (typeof nodeSteps === 'object' && Object.keys(nodeSteps).length > 0)
      );
      // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
      const hasConstraintsOverride = false;
      const hasExamplesOverride = false;
      const hasDataContractOverride = false;

      console.log('[extractModifiedDDTFields] 🔍 Checking overrides for mainNode', {
        mainNodeIndex: i,
        mainNodeId: mainNode.id,
        mainNodeTemplateId: nodeTemplateId,
        hasSteps,
        hasConstraintsOverride,
        hasExamplesOverride,
        hasDataContractOverride,
        stepsType: typeof nodeSteps,
        stepsIsArray: Array.isArray(nodeSteps),
        stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
        stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
        // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
        // Removed dataContract logging since it's not an override
      });

      if (hasSteps || hasConstraintsOverride || hasExamplesOverride || hasDataContractOverride) {
        const overrideNode: any = {
          templateId: mainNode.templateId || templateNode.templateId,
          label: mainNode.label
        };

        // ✅ CRITICAL: Salva steps usando templateId come chiave (non id)
        // task.steps[node.templateId] = steps clonati
        if (hasSteps && nodeTemplateId) {
          if (!result.steps) result.steps = {};
          result.steps[nodeTemplateId] = nodeSteps;
          console.log('[extractModifiedDDTFields] ✅ Including steps in override', {
            mainNodeIndex: i,
            nodeId: mainNode.id,
            nodeTemplateId,
            stepsType: typeof nodeSteps,
            stepsIsArray: Array.isArray(nodeSteps),
            stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
            stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
          });
        }
        // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
        // ❌ RIMOSSO: constraints/examples/dataContract non sono più override, sono sempre nel template

        // Check subTasks overrides (solo logica, non struttura)
        if (mainNode.subTasks && Array.isArray(mainNode.subTasks) && templateNode.subTasks && Array.isArray(templateNode.subTasks)) {
          const subDataOverrides: any[] = [];
          for (const subNode of mainNode.subTasks) {
            const templateSubNode = templateNode.subTasks.find((s: any) =>
              s.templateId === subNode.templateId || s.label === subNode.label
            );

            if (templateSubNode) {
              // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
              // Variables removed - not needed since we don't check for overrides

              // ✅ CORRETTO: Leggi steps da instance.steps[subNodeId], NON da subNode.steps
              const subNodeId = subNode.id;
              const subNodeSteps = subNodeId && instance.steps ? instance.steps[subNodeId] : null;
              const hasSubSteps = subNodeSteps && (
                (Array.isArray(subNodeSteps) && subNodeSteps.length > 0) ||
                (typeof subNodeSteps === 'object' && Object.keys(subNodeSteps).length > 0)
              );
              // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
              const hasSubConstraintsOverride = false;
              const hasSubExamplesOverride = false;
              const hasSubDataContractOverride = false;

              if (hasSubSteps || hasSubConstraintsOverride || hasSubExamplesOverride || hasSubDataContractOverride) {
                if (!subNode.templateId && !templateSubNode.templateId) {
                  const errorMsg = `[extractModifiedDDTFields] Sub-nodo senza templateId: ${subNode.label || subNode.id || 'unknown'}`;
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
                // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
                // ❌ RIMOSSO: constraints/examples/dataContract non sono più override, sono sempre nel template

                subDataOverrides.push(overrideSubNode);
              }
            }
          }
          if (subDataOverrides.length > 0) {
            overrideNode.subTasks = subDataOverrides;
          }
        }

        dataOverrides.push(overrideNode);
      }
    }

    if (dataOverrides.length > 0) {
      result.data = dataOverrides;
      console.log('[extractModifiedDDTFields] ✅ Saving data overrides', {
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
      console.log('[extractModifiedDDTFields] ⚠️ No data overrides found - saving empty data array');
    }
  }

  // ✅ Confronta root-level constraints/examples/nlpContract/introduction
  // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides allowed
  // Variables removed - not needed since we don't save overrides
  const templateIntroduction = template.introduction;

  // ✅ Constraints/examples/nlpContract are ALWAYS from template, NO overrides saved
  // Removed override checks since instances should not have constraints/examples

  // ❌ RIMOSSO: dataContract non è più override, è sempre nel template

  if (localDDT.introduction !== templateIntroduction) {
    result.introduction = localDDT.introduction;
  }

  console.log('[extractModifiedDDTFields] ✅ Final result', {
    hasLabel: !!result.label,
    hasdata: !!result.data,
    dataLength: result.data?.length || 0,
    hasConstraints: !!result.constraints,
    // ❌ RIMOSSO: dataContract non è più override
    hasIntroduction: !!result.introduction,
    resultKeys: Object.keys(result)
  });

  return result;
}
