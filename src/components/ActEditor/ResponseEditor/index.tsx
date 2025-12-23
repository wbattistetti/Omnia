import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { info } from '../../../utils/logger';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { getTemplateId } from '../../../utils/taskHelpers';
import { extractModifiedDDTFields } from '../../../utils/ddtMergeUtils';
import Sidebar from './Sidebar';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
import MessageReviewView from './MessageReview/MessageReviewView';
// import SynonymsEditor from './SynonymsEditor';
import NLPExtractorProfileEditor from './NLPExtractorProfileEditor';
import EditorHeader from '../../common/EditorHeader';
import { getTaskVisualsByType } from '../../Flowchart/utils/taskVisuals';
import ActionDragLayer from './ActionDragLayer';
import {
  getMainDataList,
  getSubDataList,
  getNodeSteps
} from './ddtSelectors';
import { hasIntentMessages } from './utils/hasMessages';
import IntentMessagesBuilder from './components/IntentMessagesBuilder';
import { saveIntentMessagesToDDT } from './utils/saveIntentMessages';
import { useNodeSelection } from './hooks/useNodeSelection';
import { useNodeUpdate } from './hooks/useNodeUpdate';
import { useNodePersistence } from './hooks/useNodePersistence';
import { useDDTInitialization } from './hooks/useDDTInitialization';
import { useResponseEditorToolbar } from './ResponseEditorToolbar';
import IntentListEditorWrapper from './components/IntentListEditorWrapper';
import { FontProvider, useFontContext } from '../../../context/FontContext';
import { useAIProvider } from '../../../context/AIProviderContext';
import { DialogueTaskService, type DialogueTask } from '../../../services/DialogueTaskService';
import { TemplateTranslationsService } from '../../../services/TemplateTranslationsService';
import DDTTemplateMatcherService from '../../../services/DDTTemplateMatcherService';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';
import { useDDTTranslations } from '../../../hooks/useDDTTranslations';
import { ToolbarButton } from '../../../dock/types';
import { taskTemplateService } from '../../../services/TaskTemplateService';

function ResponseEditorInner({ ddt, onClose, onWizardComplete, act, hideHeader, onToolbarUpdate }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string; instanceId?: string }, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void }) {

  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;

  // ✅ Get translations from global table (filtered by project locale)
  const { translations: globalTranslations } = useProjectTranslations();
  // Font centralizzato dal Context
  const { combinedClass } = useFontContext();
  // ✅ AI Provider per inferenza pre-wizard
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();
  const rootRef = useRef<HTMLDivElement>(null);
  const wizardOwnsDataRef = useRef(false); // Flag: wizard has control over data lifecycle
  const [isInferring, setIsInferring] = React.useState(false);
  const [inferenceResult, setInferenceResult] = React.useState<any>(null);
  const inferenceAttemptedRef = React.useRef<string | null>(null); // Track which act.label we've already tried

  // ✅ Cache globale per DDT pre-assemblati (per templateId)
  // Key: templateId (es. "723a1aa9-a904-4b55-82f3-a501dfbe0351")
  // Value: { ddt, _templateTranslations }
  const preAssembledDDTCache = React.useRef<Map<string, { ddt: any; _templateTranslations: Record<string, { en: string; it: string; pt: string }> }>>(new Map());

  const { ideTranslations, dataDialogueTranslations, replaceSelectedDDT } = useDDTManager();
  const mergedBase = useMemo(() => ({ ...(ideTranslations || {}), ...(dataDialogueTranslations || {}) }), [ideTranslations, dataDialogueTranslations]);

  // Node selection management (must be before useDDTInitialization for callback)
  const {
    selectedMainIndex,
    selectedSubIndex,
    selectedRoot,
    sidebarRef,
    setSelectedMainIndex,
    setSelectedSubIndex,
    setSelectedRoot,
    handleSelectMain,
    handleSelectSub,
    handleSelectAggregator,
  } = useNodeSelection(0); // Initial main index

  // DDT initialization (extracted to hook)

  const { localDDT, setLocalDDT, coercePhoneKind } = useDDTInitialization(
    ddt,
    wizardOwnsDataRef,
    mergedBase,
    () => {
      // Reset selection when DDT changes
      setSelectedMainIndex(0);
      setSelectedSubIndex(undefined);
    }
  );

  // Debug logger gated by localStorage flag: set localStorage.setItem('debug.responseEditor','1') to enable
  const log = (...args: any[]) => {
    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log(...args); } catch { }
  };
  // Removed verbose translation sources log
  // Ensure debug flag is set once to avoid asking again
  useEffect(() => {
    try { localStorage.setItem('debug.responseEditor', '1'); } catch { }
    try { localStorage.setItem('debug.reopen', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSelection', '1'); } catch { }
  }, []);
  // Get project language from localStorage (set when project is created/loaded)
  const projectLocale = useMemo<'en' | 'it' | 'pt'>(() => {
    try {
      const saved = localStorage.getItem('project.lang');
      if (saved === 'en' || saved === 'it' || saved === 'pt') {
        return saved;
      }
    } catch (err) {
      // Silent fail
    }
    return 'it'; // Default to Italian
  }, []);

  // Get translations for project locale
  const getTranslationsForLocale = (locale: 'en' | 'it' | 'pt', ddtTranslations: any) => {
    if (!ddtTranslations) {
      return mergedBase;
    }

    // Structure: ddt.translations = { en: {...}, it: {...}, pt: {...} }
    const localeTranslations = ddtTranslations[locale] || ddtTranslations.en || ddtTranslations;
    const result = { ...mergedBase, ...localeTranslations };
    return result;
  };

  // ✅ Load translations from global table using shared hook
  const localTranslations = useDDTTranslations(localDDT);

  // ❌ REMOVED: Sync from ddt.translations - translations are now in global table only
  // Translations are updated via the effect above that watches globalTranslations

  // FIX: Salva modifiche quando si clicca "Salva" nel progetto (senza chiudere l'editor)
  React.useEffect(() => {
    const handleProjectSave = async () => {
      if (act?.id || (act as any)?.instanceId) {
        const key = ((act as any)?.instanceId || act?.id) as string;
        const task = taskRepository.getTask(key);
        const hasDDT = localDDT && Object.keys(localDDT).length > 0 && localDDT.mainData && localDDT.mainData.length > 0;

        if (hasDDT && task) {
          // ✅ Extract only modified fields (constraints/examples/nlpContract only if modified)
          const modifiedFields = await extractModifiedDDTFields(task, localDDT);

          const currentTemplateId = getTemplateId(task);
          // ✅ CASE-INSENSITIVE
          if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
            // ✅ Update task con solo campi modificati
            taskRepository.updateTask(key, {
              templateId: 'GetData',
              ...modifiedFields
            }, currentProjectId || undefined);
          } else {
            // ✅ Update task con solo campi modificati
            taskRepository.updateTask(key, modifiedFields, currentProjectId || undefined);
          }
        } else if (localDDT) {
          // No DDT structure, but save other fields
          taskRepository.updateTask(key, localDDT, currentProjectId || undefined);
        }
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [localDDT, act?.id, (act as any)?.instanceId, currentProjectId]);

  // Persist explicitly on close only (avoid side-effects/flicker on unmount)
  const handleEditorClose = React.useCallback(async () => {

    try {
      // Se abbiamo un instanceId o act.id (caso DDTHostAdapter), salva nell'istanza
      if (act?.id || (act as any)?.instanceId) {
        const key = ((act as any)?.instanceId || act?.id) as string;
        const task = taskRepository.getTask(key);
        const hasDDT = localDDT && Object.keys(localDDT).length > 0 && localDDT.mainData && localDDT.mainData.length > 0;

        if (hasDDT && task) {
          // ✅ Extract only modified fields (constraints/examples/nlpContract only if modified)
          const modifiedFields = await extractModifiedDDTFields(task, localDDT);

          const currentTemplateId = getTemplateId(task);
          // ✅ CASE-INSENSITIVE
          if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
            // ✅ Update task con solo campi modificati
            taskRepository.updateTask(key, {
              templateId: 'GetData',
              ...modifiedFields
            }, currentProjectId || undefined);
          } else {
            // ✅ Update task con solo campi modificati
            taskRepository.updateTask(key, modifiedFields, currentProjectId || undefined);
          }
        } else if (localDDT) {
          // No DDT structure, but save other fields
          taskRepository.updateTask(key, localDDT, currentProjectId || undefined);
        }

      }

      // NON chiamare replaceSelectedDDT se abbiamo act prop (siamo in ActEditorOverlay)
      // Questo previene l'apertura di ResizableResponseEditor in AppContent mentre si chiude ActEditorOverlay
      if (!act) {
        // Modalità diretta (senza act): aggiorna selectedDDT per compatibilità legacy
        replaceSelectedDDT(localDDT);
      }
    } catch (e) {
      console.error('[ResponseEditor][handleEditorClose] Persist error', {
        actId: act?.id,
        error: e
      });
    }

    try { onClose && onClose(); } catch { }
  }, [localDDT, replaceSelectedDDT, onClose, act?.id, (act as any)?.instanceId, currentProjectId]);

  const mainList = useMemo(() => getMainDataList(localDDT), [localDDT]);
  // Aggregated view: show a group header when there are multiple mains
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1
  ), [mainList]);
  const [rightMode, setRightMode] = useState<RightPanelMode>('actions'); // Always start with actions panel visible
  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);
  const [dragging, setDragging] = useState(false);
  const [showSynonyms, setShowSynonyms] = useState(false);
  const [showMessageReview, setShowMessageReview] = useState(false);
  const [selectedIntentIdForTraining, setSelectedIntentIdForTraining] = useState<string | null>(null);

  // Header: icon, title, and toolbar
  const actType = (act?.type || 'DataRequest') as any;

  // ✅ Verifica se kind === "intent" e non ha messaggi (mostra IntentMessagesBuilder se non ci sono)
  const needsIntentMessages = useMemo(() => {
    const firstMain = mainList[0];
    const hasMessages = hasIntentMessages(localDDT);
    return firstMain?.kind === 'intent' && !hasMessages;
  }, [mainList, localDDT, act?.id, act?.type]);

  // Wizard/general layout flags
  // ✅ Se kind === "intent" non ha bisogno di wizard (nessuna struttura dati)
  const [showWizard, setShowWizard] = useState<boolean>(() => {
    const firstMain = mainList[0];
    if (firstMain?.kind === 'intent') {
      return false;
    }
    // ✅ NON aprire il wizard subito - aspetta che il match locale venga eseguito
    // Il wizard verrà aperto dall'useEffect dopo il match locale o l'inferenza
    return false;
  });
  const { Icon, color: iconColor } = getTaskVisualsByType(actType, !!localDDT);
  // Priority: _sourceAct.label (preserved act info) > act.label (direct prop) > localDDT._userLabel (legacy) > generic fallback
  // NOTE: Do NOT use localDDT.label here - that's the DDT root label (e.g. "Age") which belongs in the TreeView, not the header
  const sourceAct = (localDDT as any)?._sourceAct;
  const headerTitle = sourceAct?.label || act?.label || (localDDT as any)?._userLabel || 'Response Editor';

  const saveRightMode = (m: RightPanelMode) => {
    setRightMode(m);
    try { localStorage.setItem('responseEditor.rightMode', m); } catch { }
  };

  // Toolbar buttons (extracted to hook)
  const toolbarButtons = useResponseEditorToolbar({
    showWizard,
    rightMode,
    showSynonyms,
    showMessageReview,
    onRightModeChange: saveRightMode,
    onToggleSynonyms: () => setShowSynonyms(v => !v),
    onToggleMessageReview: () => setShowMessageReview(v => !v),
  });

  // Ref per prevenire esecuzioni multiple dello stesso processo
  const inferenceStartedRef = useRef<string | null>(null);

  useEffect(() => {
    // ✅ Se kind === "intent" non deve mostrare il wizard
    const currentMainList = getMainDataList(localDDT);
    const firstMain = currentMainList[0];
    if (firstMain?.kind === 'intent') {
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isDDTEmpty(localDDT);

    // ✅ IMPORTANTE: Non aprire wizard se l'inferenza è in corso
    // ✅ IMPORTANTE: Non aprire wizard se è già aperto (showWizard === true)
    const conditionsMet = empty && !wizardOwnsDataRef.current && !isInferring && !showWizard;

    // Prevenire esecuzioni multiple per lo stesso act.label
    const actLabel = act?.label?.trim();
    const inferenceKey = `${actLabel || ''}_${empty}`;
    if (!conditionsMet || inferenceStartedRef.current === inferenceKey) {
      return;
    }

    if (conditionsMet) {
      // ✅ Se c'è act.label, PRIMA prova euristica, POI inferenza AI
      const actLabel = act?.label?.trim();
      const shouldInfer = actLabel && actLabel.length >= 3 && inferenceAttemptedRef.current !== actLabel;

      // ✅ PRIMA: Se è in corso l'inferenza, aspetta (NON aprire il wizard ancora)
      if (isInferring) {
        // Non fare nulla, aspetta che l'inferenza finisca
        return; // ✅ IMPORTANTE: esci dall'useEffect, non continuare
      }

      // ✅ SECONDO: Se deve inferire E non sta già inferendo E non abbiamo ancora risultato
      if (shouldInfer && !inferenceResult) {
        inferenceAttemptedRef.current = actLabel;

        /**
         * ============================================================
         * EURISTICA 2: DETERMINAZIONE TEMPLATE DDT SPECIFICO
         * ============================================================
         * Funzione: findDDTTemplate
         * Scopo: Determina il template DDT specifico dalla label di riga di nodo
         *        usando match fuzzy sulle label dei template
         * Usata in: ResponseEditor quando si apre il wizard DDT
         * Output: Template DDT completo con mainData/subData già strutturato
         * Nota: Questa euristica viene eseguita PRIMA dell'inferenza AI
         * ============================================================
         */

        const findDDTTemplate = async (text: string): Promise<any | null> => {
          try {
            // ✅ Usa il servizio centralizzato per trovare il match
            const currentTaskType = act?.type || 'UNDEFINED';
            const match = await DDTTemplateMatcherService.findDDTTemplate(text, currentTaskType);

            if (!match) {
              return null;
            }

            const template = match.template;

            // ✅ FASE 2: Costruisci istanza DDT dal template
            // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
            // quindi può avere tutti i 6 tipi di stepPrompts (start, noMatch, noInput, confirmation, notConfirmed, success).
            // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
            // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
            const subDataIds = template.subDataIds || [];

            let mainData: any[] = [];

            if (subDataIds.length > 0) {
              // ✅ Template composito: crea UN SOLO mainData con subData[] popolato

              // ✅ PRIMA: Costruisci array di subData instances
              // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
              const subDataInstances: any[] = [];

              for (const subId of subDataIds) {
                // ✅ Cerca template per ID (può essere _id, id, name, o label)
                const subTemplate = DialogueTaskService.getTemplate(subId);
                if (subTemplate) {
                  // ✅ Filtra stepPrompts: solo start, noInput, noMatch per sottodati
                  // Ignora confirmation, notConfirmed, success anche se presenti nel template sottodato
                  const filteredStepPrompts: any = {};
                  if (subTemplate.stepPrompts) {
                    if (subTemplate.stepPrompts.start) {
                      filteredStepPrompts.start = subTemplate.stepPrompts.start;
                    }
                    if (subTemplate.stepPrompts.noInput) {
                      filteredStepPrompts.noInput = subTemplate.stepPrompts.noInput;
                    }
                    if (subTemplate.stepPrompts.noMatch) {
                      filteredStepPrompts.noMatch = subTemplate.stepPrompts.noMatch;
                    }
                    // ❌ Ignoriamo: confirmation, notConfirmed, success
                  }

                  // ✅ Usa la label del template trovato (non l'ID!)
                  subDataInstances.push({
                    label: subTemplate.label || subTemplate.name || 'Sub',
                    type: subTemplate.type,
                    icon: subTemplate.icon || 'FileText',
                    stepPrompts: Object.keys(filteredStepPrompts).length > 0 ? filteredStepPrompts : undefined,
                    constraints: subTemplate.dataContracts || subTemplate.constraints || [],
                    examples: subTemplate.examples || [],
                    subData: [],
                    // ✅ Copia anche nlpContract, templateId e kind dal sub-template (saranno adattati in assembleFinal)
                    nlpContract: subTemplate.nlpContract || undefined,
                    templateId: subTemplate.id || subTemplate._id, // ✅ GUID del template per lookup
                    kind: subTemplate.name || subTemplate.type || 'generic'
                  });
                }
              }

              // ✅ POI: Crea UN SOLO mainData con subData[] popolato (non elementi separati!)
              // L'istanza principale copia TUTTI i stepPrompts dal template (tutti e 6 i tipi)
              const mainInstance = {
                label: template.label || template.name || 'Data',
                type: template.type,
                icon: template.icon || 'Calendar',
                stepPrompts: template.stepPrompts || undefined, // ✅ Tutti e 6 i tipi per main
                constraints: template.dataContracts || template.constraints || [],
                examples: template.examples || [],
                subData: subDataInstances, // ✅ Sottodati QUI dentro subData[], non in mainData[]
                // ✅ Copia anche nlpContract, templateId e kind dal template (saranno adattati in assembleFinal)
                nlpContract: template.nlpContract || undefined,
                templateId: template.id || template._id, // ✅ GUID del template per lookup
                kind: template.name || template.type || 'generic'
              };

              mainData.push(mainInstance); // ✅ UN SOLO elemento in mainData
            } else {
              // ✅ Template semplice: crea istanza dal template root
              const mainInstance = {
                label: template.label || template.name || 'Data',
                type: template.type,
                icon: template.icon || 'Calendar',
                stepPrompts: template.stepPrompts || undefined,
                constraints: template.dataContracts || template.constraints || [],
                examples: template.examples || [],
                subData: [],
                // ✅ Copia anche nlpContract, templateId e kind dal template (saranno adattati in assembleFinal)
                nlpContract: template.nlpContract || undefined,
                templateId: template.id || template._id, // ✅ GUID del template per lookup
                kind: template.name || template.type || 'generic'
              };
              mainData.push(mainInstance);
            }

            // ✅ Estrai tutti i GUID dai stepPrompts (ma NON caricare le traduzioni ancora!)
            const allGuids: string[] = [];
            mainData.forEach((m: any) => {
              if (m.stepPrompts) {
                Object.values(m.stepPrompts).forEach((guids: any) => {
                  if (Array.isArray(guids)) {
                    guids.forEach((guid: string) => {
                      if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                        allGuids.push(guid);
                      }
                    });
                  }
                });
              }
              if (m.subData) {
                m.subData.forEach((s: any) => {
                  if (s.stepPrompts) {
                    Object.values(s.stepPrompts).forEach((guids: any) => {
                      if (Array.isArray(guids)) {
                        guids.forEach((guid: string) => {
                          if (typeof guid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
                            allGuids.push(guid);
                          }
                        });
                      }
                    });
                  }
                });
              }
            });

            // ✅ Ritorna schema + lista GUID (senza caricare traduzioni ancora)
            // Le traduzioni saranno caricate in background dopo l'apertura del wizard
            return {
              ai: {
                schema: {
                  label: template.label || template.name || 'Data',
                  mainData: mainData,
                  // Include stepPrompts a livello schema se presente
                  stepPrompts: template.stepPrompts || undefined
                },
                icon: template.icon || 'Calendar',
                // ✅ Includi solo i GUID, le traduzioni saranno caricate in background
                translationGuids: [...new Set(allGuids)]
              }
            };
          } catch (error) {
            console.error('[ResponseEditor] ❌ [EURISTICA] Errore in findDDTTemplate:', error);
            return null;
          }
        };

        // ✅ PRIMA: Prova euristica locale (ISTANTANEO, cache già caricata)

        // ✅ Controlla cache traduzioni
        const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';

        // ✅ Wrappare in IIFE async perché useEffect non può essere async
        (async () => {
          inferenceStartedRef.current = inferenceKey;
          const localMatch = await findDDTTemplate(actLabel);
          if (localMatch) {
            // ✅ Euristica trovata ISTANTANEAMENTE → apri wizard subito (NON avviare inferenza AI)

            // ✅ Se Euristica 1 ha trovato UNDEFINED (nessun match), Euristica 2 inferisce il tipo dal template DDT

            if (act?.instanceId && act.type === 'UNDEFINED') {
              try {
                const instanceKey = act.instanceId;
                let task = taskRepository.getTask(instanceKey);

                if (task) {
                }

                if (task) {
                  // Aggiorna il task per impostare templateId = 'GetData' e type = DataRequest
                  const currentTemplateId = getTemplateId(task);
                  if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
                    taskRepository.updateTask(instanceKey, {
                      templateId: 'GetData',
                      // ✅ Fields directly on task (no value wrapper) - copy all fields except id, templateId, createdAt, updatedAt
                      ...Object.fromEntries(
                        Object.entries(task).filter(([key]) =>
                          !['id', 'templateId', 'createdAt', 'updatedAt'].includes(key)
                        )
                      )
                    }, currentProjectId || undefined);

                    // Verifica aggiornamento
                    const updatedTask = taskRepository.getTask(instanceKey);
                  } else {
                  }
                } else {
                  // Crea nuovo task con GetData
                  taskRepository.createTask('GetData', undefined, instanceKey, currentProjectId || undefined);

                  // Verifica creazione
                  const newTask = taskRepository.getTask(instanceKey);
                }
              } catch (err) {
                console.error('[ResponseEditor] Errore aggiornamento task:', err);
              }
            } else {
            }


            setInferenceResult(localMatch);
            setShowWizard(true);
            wizardOwnsDataRef.current = true;

            // ✅ Carica traduzioni + PRE-ASSEMBLY IN BACKGROUND (mentre wizard mostra Yes/No)
            const translationGuids = localMatch?.ai?.translationGuids || [];
            const schema = localMatch?.ai?.schema;
            const templateId = schema?.mainData?.[0]?.templateId; // ✅ ID del template per cache

            if (translationGuids.length > 0 && schema) {
              // ✅ CONTROLLA CACHE PRIMA!
              if (templateId && preAssembledDDTCache.current.has(templateId)) {
                const cached = preAssembledDDTCache.current.get(templateId)!;
                setInferenceResult((prev: any) => ({
                  ...prev,
                  ai: {
                    ...prev?.ai,
                    templateTranslations: cached._templateTranslations,
                    preAssembledDDT: cached.ddt
                  }
                }));
              } else {
                // ✅ Pre-assembly solo se NON in cache
                (async () => {
                  try {
                    // 1. Carica traduzioni
                    const { getTemplateTranslations } = await import('../../../services/ProjectDataService');
                    const templateTranslations = await getTemplateTranslations(translationGuids);

                    // 2. PRE-ASSEMBLY del DDT (in background!)
                    const { assembleFinalDDT } = await import('../../DialogueDataTemplateBuilder/DDTWizard/assembleFinal');
                    const { buildArtifactStore } = await import('../../DialogueDataTemplateBuilder/DDTWizard/artifactStore');

                    const emptyStore = buildArtifactStore([]);
                    const projectLang = (localStorage.getItem('project.lang') || 'pt') as 'en' | 'it' | 'pt';

                    const preAssembledDDT = await assembleFinalDDT(
                      schema.label || 'Data',
                      schema.mainData || [],
                      emptyStore,
                      {
                        escalationCounts: { noMatch: 2, noInput: 2, confirmation: 2 },
                        templateTranslations: templateTranslations,
                        projectLocale: projectLang,
                        addTranslations: () => { } // Idempotente
                      }
                    );

                    // ✅ SALVA IN CACHE!
                    if (templateId) {
                      preAssembledDDTCache.current.set(templateId, {
                        ddt: preAssembledDDT,
                        _templateTranslations: templateTranslations
                      });
                    }

                    // ✅ Aggiorna inferenceResult con traduzioni + DDT pre-assemblato
                    setInferenceResult((prev: any) => ({
                      ...prev,
                      ai: {
                        ...prev?.ai,
                        templateTranslations: templateTranslations,
                        preAssembledDDT: preAssembledDDT
                      }
                    }));
                  } catch (err) {
                    console.error('[ResponseEditor] Errore pre-assemblaggio:', err);
                  }
                })();
              }
            }

            return; // ✅ Euristica trovata, non chiamare API
          }

          // ✅ SECONDO: Se euristica non trova nulla, allora avvia inferenza AI
          setIsInferring(true); // ✅ Mostra messaggio "Sto cercando..." solo durante inferenza AI

          // ✅ IIFE async per gestire inferenza AI
          (async () => {
            // ✅ Chiama API con timeout
            const performAPICall = async () => {
              try {
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Inference timeout')), 10000); // 10 secondi
                });

                const fetchPromise = fetch('/step2-with-provider', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userDesc: actLabel,
                    provider: selectedProvider.toLowerCase(),
                    model: selectedModel
                  }),
                });

                const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

                if (response.ok) {
                  const result = await response.json();
                  // ✅ API success → apri wizard con risultato (step 'heuristic-confirm')
                  setInferenceResult(result);
                  setShowWizard(true);
                  wizardOwnsDataRef.current = true;
                } else {
                  // ✅ API fallita → apri wizard con step 'input' ("Describe in detail...")
                  setInferenceResult(null);
                  setShowWizard(true);
                  wizardOwnsDataRef.current = true;
                }
              } catch (error) {
                console.error('[ResponseEditor] Errore inferenza API:', error);
                // ✅ API fallita → apri wizard con step 'input' ("Describe in detail...")
                setInferenceResult(null);
                setShowWizard(true);
                wizardOwnsDataRef.current = true;
              } finally {
                setIsInferring(false);
              }
            };

            performAPICall();
          })(); // ✅ Fine IIFE async per inferenza AI
        })(); // ✅ Fine IIFE esterna per euristica
        return; // ✅ IMPORTANTE: esci dall'useEffect dopo aver avviato l'inferenza
      }

      // ✅ QUARTO: Se non era necessaria l'inferenza (testo troppo corto o già tentato), apri il wizard
      if (!shouldInfer) {
        inferenceStartedRef.current = inferenceKey;
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
      }
    }

    if (!empty && wizardOwnsDataRef.current && showWizard) {
      // DDT is complete and wizard had ownership → close wizard
      setShowWizard(false);
      inferenceStartedRef.current = null; // Reset quando il wizard viene chiuso
    }
  }, [localDDT, act, isInferring, inferenceResult, selectedProvider, selectedModel, showWizard]); // ✅ Rimosso mainList dalle dipendenze

  // Track introduction separately to avoid recalculating selectedNode when localDDT changes
  const introduction = useMemo(() => localDDT?.introduction, [localDDT?.introduction]);

  // ✅ RISCRITTURA PULITA: selectedNode è uno stato diretto, non una derivazione
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<{
    mainIndex: number;
    subIndex?: number;
  } | null>(null);

  // Inizializza selectedNode quando mainList è pronto
  useEffect(() => {
    if (!selectedNode && mainList.length > 0) {
      // Usa gli indici attuali da useNodeSelection
      const node = selectedSubIndex == null
        ? mainList[selectedMainIndex]
        : getSubDataList(mainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        setSelectedNode(node);
        setSelectedNodePath({
          mainIndex: selectedMainIndex,
          subIndex: selectedSubIndex
        });
      }
    }
  }, [mainList, selectedNode, selectedMainIndex, selectedSubIndex]);

  // Aggiorna selectedNode quando cambiano gli indici di selezione
  useEffect(() => {
    if (mainList.length > 0) {
      if (selectedRoot) {
        // Root selected
        const introStep = introduction
          ? { type: 'introduction', escalations: introduction.escalations }
          : { type: 'introduction', escalations: [] };
        const newNode = { ...localDDT, steps: [introStep] };

        try {
          if (localStorage.getItem('debug.responseEditor') === '1') {
            console.log('[selectedNode] Updated (root)', {
              hasTestCases: !!newNode.nlpProfile?.testCases,
              testCasesCount: (newNode.nlpProfile?.testCases || []).length
            });
          }
        } catch { }

        setSelectedNode(newNode);
        setSelectedNodePath(null);
      } else {
        // Main or sub selected
        const node = selectedSubIndex == null
          ? mainList[selectedMainIndex]
          : getSubDataList(mainList[selectedMainIndex])?.[selectedSubIndex];

        if (node) {
          try {
            if (localStorage.getItem('debug.responseEditor') === '1') {
              console.log('[selectedNode] Updated', {
                nodeLabel: node.label,
                hasNlpProfile: !!node.nlpProfile,
                hasTestCases: !!node.nlpProfile?.testCases,
                testCasesCount: (node.nlpProfile?.testCases || []).length,
                testCases: node.nlpProfile?.testCases
              });
            }
          } catch { }

          setSelectedNode(node);
          setSelectedNodePath({
            mainIndex: selectedMainIndex,
            subIndex: selectedSubIndex
          });
        }
      }
    }
  }, [selectedMainIndex, selectedSubIndex, selectedRoot, localDDT, introduction]); // ✅ Rimosso mainList per evitare sovrascrittura

  // ✅ Aggiorna selectedNode quando mainList cambia (per sincronizzare dopo handleProfileUpdate)
  useEffect(() => {
    if (mainList.length > 0 && !selectedRoot && selectedNodePath) {
      const node = selectedSubIndex == null
        ? mainList[selectedMainIndex]
        : getSubDataList(mainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        // ✅ Aggiorna solo se nlpProfile è diverso (evita loop infiniti)
        const currentNodeNlpProfile = JSON.stringify(selectedNode?.nlpProfile || {});
        const newNodeNlpProfile = JSON.stringify(node.nlpProfile || {});

        if (currentNodeNlpProfile !== newNodeNlpProfile) {
          setSelectedNode(node);
        }
      }
    }
  }, [mainList]); // ✅ Solo quando mainList cambia (dopo aggiornamento localDDT)

  // ✅ handleProfileUpdate: aggiorna IMMEDIATAMENTE sia selectedNode che localDDT
  const handleProfileUpdate = useCallback((partialProfile: any) => {
    // ✅ Aggiorna selectedNode IMMEDIATAMENTE per feedback UI istantaneo
    setSelectedNode((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        nlpProfile: {
          ...(prev.nlpProfile || {}),
          ...partialProfile
        }
      };
    });

    // ✅ Aggiorna localDDT per persistenza
    setLocalDDT((prev: any) => {
      if (!prev || !selectedNodePath) return prev;

      const mains = getMainDataList(prev);
      const { mainIndex, subIndex } = selectedNodePath;

      if (mainIndex >= mains.length) return prev;

      const main = mains[mainIndex];

      // Caso MAIN node
      if (subIndex === undefined) {
        const updatedMain = {
          ...main,
          nlpProfile: {
            ...(main.nlpProfile || {}),
            ...partialProfile
          }
        };

        const newMainData = [...mains];
        newMainData[mainIndex] = updatedMain;

        return { ...prev, mainData: newMainData };
      }

      // Caso SUB node
      const subList = main.subData || [];
      if (subIndex >= subList.length) return prev;

      const updatedSub = {
        ...subList[subIndex],
        nlpProfile: {
          ...(subList[subIndex].nlpProfile || {}),
          ...partialProfile
        }
      };

      const newSubData = [...subList];
      newSubData[subIndex] = updatedSub;

      const updatedMain = { ...main, subData: newSubData };

      const newMainData = [...mains];
      newMainData[mainIndex] = updatedMain;

      return { ...prev, mainData: newMainData };
    });
  }, [selectedNodePath]);

  // Step keys per il nodo selezionato: se root selezionato, sempre 'introduction' (anche se vuoto, per permettere creazione)
  const stepKeys = useMemo(() => {
    if (selectedRoot) {
      // Root selected: always show 'introduction' (even if empty, to allow creation)
      return ['introduction'];
    }
    const steps = selectedNode ? getNodeSteps(selectedNode) : [];

    // Removed verbose log

    return steps;
  }, [selectedNode, selectedRoot, selectedSubIndex]);
  // Append V2 notConfirmed for main node if present (not for root)
  const uiStepKeys = useMemo(() => {
    let result: string[];
    if (selectedRoot) {
      result = stepKeys; // Root doesn't have notConfirmed
    } else if (selectedSubIndex != null) {
      result = stepKeys; // Sub nodes don't have notConfirmed
    } else if (!stepKeys.includes('notConfirmed')) {
      result = [...stepKeys, 'notConfirmed'];
    } else {
      result = stepKeys;
    }

    // Removed verbose log

    return result;
  }, [stepKeys, selectedSubIndex, selectedRoot]);
  const [selectedStepKey, setSelectedStepKey] = useState<string>('');

  // Mantieni lo step selezionato quando cambia il dato. Se lo step non esiste per il nuovo dato, fallback al primo disponibile.
  React.useEffect(() => {
    if (!stepKeys.length) { setSelectedStepKey(''); return; }
    if (selectedStepKey && stepKeys.includes(selectedStepKey)) return;
    // Prefer default 'start' if present, otherwise first available
    const preferred = stepKeys.includes('start') ? 'start' : stepKeys[0];
    setSelectedStepKey(preferred);
  }, [stepKeys, selectedStepKey]);

  // Snapshot log su cambio selezione (abilita con localStorage.setItem('debug.reopen','1'))
  React.useEffect(() => {
    try {
      if (localStorage.getItem('debug.reopen') === '1') {
        // Selection changed, could track analytics here if needed
      }
    } catch { }
  }, [mainList, selectedMainIndex, selectedSubIndex, selectedStepKey, stepKeys]);

  // Node update logic (extracted to hook)
  const { updateSelectedNode } = useNodeUpdate(
    localDDT,
    setLocalDDT,
    selectedRoot,
    selectedMainIndex,
    selectedSubIndex,
    replaceSelectedDDT
  );

  // Node persistence/normalization logic (extracted to hook)
  const { normalizeAndPersistModel } = useNodePersistence(
    selectedStepKey,
    updateSelectedNode
  );

  // kept for future translation edits in StepEditor

  // Splitter drag handlers
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const total = window.innerWidth;
      const leftMin = 320;
      const minRight = 160;
      const maxRight = Math.max(minRight, total - leftMin);
      const newWidth = Math.max(minRight, Math.min(maxRight, total - e.clientX));
      setRightWidth(newWidth);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, setRightWidth]);

  // Funzione per capire se c'├¿ editing attivo (input, textarea, select)
  function isEditingActive() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
  }

  // Handler tastiera globale per step navigation
  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (sidebarRef.current && document.activeElement === sidebarRef.current && !isEditingActive()) {
      if (e.key === 'ArrowRight') {
        const idx = stepKeys.indexOf(selectedStepKey);
        if (idx >= 0 && idx < stepKeys.length - 1) {
          setSelectedStepKey(stepKeys[idx + 1]);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.key === 'ArrowLeft') {
        const idx = stepKeys.indexOf(selectedStepKey);
        if (idx > 0) {
          setSelectedStepKey(stepKeys[idx - 1]);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };


  // Esponi toolbar tramite callback quando in docking mode
  const headerColor = '#9a4f00'; // Orange color from EditorHeader theme
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      // Always call onToolbarUpdate when toolbarButtons changes, even if empty
      // This ensures the tab header is updated with the latest toolbar state
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, toolbarButtons, onToolbarUpdate, headerColor]);

  // Layout
  return (
    <div ref={rootRef} className={combinedClass} style={{ height: '100%', maxHeight: '100%', background: '#0b0f17', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onKeyDown={handleGlobalKeyDown}>

      {/* Header sempre visibile (minimale durante wizard, completo dopo) - nascosto quando in docking mode */}
      {!hideHeader && (
        <EditorHeader
          icon={<Icon size={18} style={{ color: iconColor }} />}
          title={headerTitle}
          toolbarButtons={toolbarButtons}
          onClose={handleEditorClose}
          color="orange"
        />
      )}

      {/* Contenuto */}
      {(() => {
        return null;
      })()}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, maxHeight: '100%' }}>
        {act?.type === 'Summarizer' && isDDTEmpty(localDDT) ? (
          /* Placeholder for Summarizer when DDT is empty */
          <div className={combinedClass} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px', color: '#e2e8f0', lineHeight: 1.6 }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 className={combinedClass} style={{ fontWeight: 700, marginBottom: '16px', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Summarizing (in arrivo)
              </h2>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Questo modulo (generale) riepiloga dati raccolti e chiede conferma (opzionale) con gestione delle correzioni.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Il designer deve solo specificare quali dati vanno riepilogati.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>📌 Esempio:</p>
              <div className={combinedClass} style={{ marginBottom: '16px', padding: '16px', background: '#1e293b', borderRadius: '8px', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Salve, buongiorno.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Buongiorno! Riepilogo i dati: Mario Rossi, nato a Milano il 17 maggio 1980, residente in via Ripamonti numero 13. Giusto?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> No, l'indirizzo esatto è via RI-GA-MON-TI non Ripamonti e sono nato il 18 maggio non il 17</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certo. Mario Rossi, nato a Milano il 18 maggio 1980, residente in via Rigamonti al numero 17. Giusto?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Giusto!</div>
                <div><strong>🤖 Agente:</strong> Perfetto.</div>
              </div>
            </div>
          </div>
        ) : act?.type === 'Negotiation' && isDDTEmpty(localDDT) ? (
          /* Placeholder for Negotiation when DDT is empty */
          <div className={combinedClass} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px', color: '#e2e8f0', lineHeight: 1.6 }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 className={combinedClass} style={{ fontWeight: 700, marginBottom: '16px', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Negotiation (in arrivo)
              </h2>
              <p className={combinedClass} style={{ marginBottom: '16px' }}>
                Questo modulo gestisce la negoziazione di una serie di "estrazioni con vincoli" da una insieme di opzioni. Vale per date, orari, o in generale insieme di opzioni.
              </p>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>Il modulo supporta:</p>
              <ul className={combinedClass} style={{ marginBottom: '16px', paddingLeft: '24px' }}>
                <li>Proposte e controproposte</li>
                <li>Riformulazioni e chiarimenti</li>
                <li>Ripetizione delle opzioni</li>
                <li>Navigazione avanti e indietro tra le alternative</li>
                <li>Impostazione di vincoli o preferenze (es. "solo dopo le 17", "non il lunedì")</li>
              </ul>
              <p className={combinedClass} style={{ marginBottom: '16px', fontWeight: 600 }}>📌 Esempio di dialogo di negoziazione (data appuntamento):</p>
              <div className={combinedClass} style={{ marginBottom: '16px', padding: '16px', background: '#1e293b', borderRadius: '8px', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Salve, buongiorno.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Buongiorno! Abbiamo disponibilità per dopodomani alle 12, le andrebbe bene?</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> No, guardi, dopodomani non va bene. La settimana prossima? Ci sono date? Io potrei da giovedì.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certo! Giovedì abbiamo alle 17:45, poi venerdì alle 12. Altrimenti possiamo andare a lunedì successivo alle 14:00.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Mi scusi, mi può ripetere gli orari di giovedì?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Certamente. Giovedì alle 17:45.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Mmm, è troppo tardi. Invece lunedi?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Martedi 23?</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Martedi 23 abbiamo disponibilita alle 19.</div>
                <div style={{ marginBottom: '8px' }}><strong>👤 Utente:</strong> Ancora peggio. Allora facciamo gioved' alle 17:45.</div>
                <div style={{ marginBottom: '8px' }}><strong>🤖 Agente:</strong> Ok Va bene per giovedi alle 17:45 allora?</div>
                <div><strong>👤 Utente:</strong> Si va bene.</div>
              </div>
            </div>
          </div>
        ) : isInferring ? (
          /* Mostra loading durante ricerca modello */
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
            </div>
          </div>
        ) : showWizard ? (
          /* Full-screen wizard without RightPanel */
          /* ✅ FIX: Non montare wizard se dovrebbe avere inferenceResult ma non ce l'ha ancora */
          (() => {
            // Se abbiamo act.label e dovremmo aver fatto inferenza, aspetta inferenceResult
            // ✅ MA solo se l'inferenza è ancora in corso (isInferring === true)
            // ✅ Se l'inferenza è finita ma non c'è risultato, apri comunque il wizard
            const actLabel = act?.label?.trim();
            const shouldHaveInference = actLabel && actLabel.length >= 3;

            // ✅ Mostra loading solo se l'inferenza è ancora in corso
            if (shouldHaveInference && !inferenceResult && isInferring) {
              return (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
                  </div>
                </div>
              );
            }

            // ✅ Se l'inferenza è finita ma non c'è risultato, apri comunque il wizard
            // (l'inferenza potrebbe essere fallita o non necessaria)

            return (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <DDTWizard
                  taskType={act?.type} // ✅ Passa tipo task per filtrare template nello step 1
                  initialDDT={inferenceResult?.ai?.schema ? {
                    // ✅ Pre-compila con il risultato dell'inferenza
                    id: localDDT?.id || `temp_ddt_${act?.id}`,
                    label: inferenceResult.ai.schema.label || act?.label || 'Data',
                    mainData: inferenceResult.ai.schema.mainData || [],
                    _inferenceResult: inferenceResult // Passa anche il risultato completo per riferimento (con traduzioni se disponibili)
                  } : localDDT}
                  onCancel={onClose || (() => { })}
                  onComplete={(finalDDT, messages) => {
                    if (!finalDDT) {
                      console.error('[ResponseEditor] onComplete called with null/undefined finalDDT');
                      return;
                    }

                    const coerced = coercePhoneKind(finalDDT);

                    // Set flag to prevent auto-reopen IMMEDIATELY (before any state updates)
                    wizardOwnsDataRef.current = true;

                    // Update local DDT state first (ALWAYS do this)
                    setLocalDDT(coerced);

                    try {
                      replaceSelectedDDT(coerced);
                    } catch (err) {
                      console.error('[ResponseEditor] replaceSelectedDDT FAILED', err);
                    }

                    // ✅ IMPORTANTE: Chiudi SEMPRE il wizard quando onComplete viene chiamato
                    // Il wizard ha già assemblato il DDT, quindi non deve riaprirsi
                    // Non controllare isEmpty qui perché potrebbe causare race conditions
                    setShowWizard(false);
                    inferenceStartedRef.current = null; // Reset quando il wizard viene completato

                    setRightMode('actions'); // Force show ActionList
                    setSelectedStepKey('start'); // Start with first step

                    // If parent provided onWizardComplete, notify it after updating UI
                    // (but don't close the overlay - let user see the editor)
                    if (onWizardComplete) {
                      onWizardComplete(coerced);
                    }
                  }}
                  startOnStructure={false}
                />
              </div>
            );
          })()
        ) : needsIntentMessages ? (
          /* Build Messages UI for ProblemClassification without messages */
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '16px 20px' }}>
            <IntentMessagesBuilder
              intentLabel={act?.label || localDDT?.label || 'chiedi il problema'}
              onComplete={(messages) => {
                const updatedDDT = saveIntentMessagesToDDT(localDDT, messages);
                setLocalDDT(updatedDDT);

                // ✅ CRITICO: Salva il DDT nell'istanza IMMEDIATAMENTE quando si completano i messaggi
                // Questo assicura che quando si fa "Save" globale, l'istanza abbia il DDT aggiornato
                if (act?.id || (act as any)?.instanceId) {
                  const key = ((act as any)?.instanceId || act?.id) as string;
                  // ✅ MIGRATION: Use getTemplateId() helper
                  // ✅ FIX: Se c'è un DDT, assicurati che il templateId sia 'GetData'
                  const task = taskRepository.getTask(key);
                  const hasDDT = updatedDDT && Object.keys(updatedDDT).length > 0 && updatedDDT.mainData && updatedDDT.mainData.length > 0;
                  if (hasDDT && task) {
                    const currentTemplateId = getTemplateId(task);
                    // ✅ CASE-INSENSITIVE
                    // ✅ Update task con campi DDT direttamente (niente wrapper value)
                    if (!currentTemplateId || currentTemplateId.toLowerCase() !== 'getdata') {
                      taskRepository.updateTask(key, {
                        templateId: 'GetData',
                        ...updatedDDT  // ✅ Spread: label, mainData, stepPrompts, ecc.
                      }, currentProjectId || undefined);
                    } else {
                      taskRepository.updateTask(key, {
                        ...updatedDDT  // ✅ Spread: label, mainData, stepPrompts, ecc.
                      }, currentProjectId || undefined);
                    }
                  } else if (hasDDT) {
                    // Task doesn't exist, create it with GetData templateId
                    taskRepository.createTask('GetData', updatedDDT, key, currentProjectId || undefined);
                  } else {
                    // FIX: Salva con projectId per garantire persistenza nel database
                    taskRepository.updateTask(key, {
                      ...updatedDDT  // ✅ Spread: label, mainData, stepPrompts, ecc.
                    }, currentProjectId || undefined);
                  }

                  // ✅ FIX: Notifica il parent (DDTHostAdapter) che il DDT è stato aggiornato
                  onWizardComplete?.(updatedDDT);
                }

                try {
                  replaceSelectedDDT(updatedDDT);
                } catch (err) {
                  console.error('[ResponseEditor][replaceSelectedDDT] FAILED', err);
                }

                // After saving, show normal editor (needsIntentMessages will become false)
              }}
            />
          </div>
        ) : (
          /* Normal editor layout with 3 panels (no header, already shown above) */
          <>
            {/* ✅ Left navigation - IntentListEditor quando kind === "intent", Sidebar altrimenti */}
            {mainList[0]?.kind === 'intent' && act && (
              <IntentListEditorWrapper
                act={act}
                onIntentSelect={(intentId) => {
                  // Store selected intent ID in state to pass to EmbeddingEditor
                  setSelectedIntentIdForTraining(intentId);
                }}
              />
            )}
            {mainList[0]?.kind !== 'intent' && (
              <Sidebar
                ref={sidebarRef}
                mainList={mainList}
                selectedMainIndex={selectedMainIndex}
                onSelectMain={handleSelectMain}
                selectedSubIndex={selectedSubIndex}
                onSelectSub={handleSelectSub}
                aggregated={isAggregatedAtomic}
                rootLabel={localDDT?.label || 'Data'}
                onChangeSubRequired={(mIdx: number, sIdx: number, required: boolean) => {
                  // Persist required flag on the exact sub (by indices), independent of current selection
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    const main = mains[mIdx];
                    if (!main) return prev;
                    const subList = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= subList.length) return prev;
                    subList[sIdx] = { ...subList[sIdx], required };
                    main.subData = subList;
                    mains[mIdx] = main;
                    next.mainData = mains;
                    try {
                      const subs = getSubDataList(main) || [];
                      const target = subs[sIdx];
                      if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subRequiredToggle][persist]', { main: main?.label, label: target?.label, required });
                    } catch { }
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onReorderSub={(mIdx: number, fromIdx: number, toIdx: number) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    const main = mains[mIdx];
                    if (!main) return prev;
                    const subList = Array.isArray(main.subData) ? main.subData : [];
                    if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return prev;
                    const [moved] = subList.splice(fromIdx, 1);
                    subList.splice(toIdx, 0, moved);
                    main.subData = subList;
                    mains[mIdx] = main;
                    next.mainData = mains;
                    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subReorder][persist]', { main: main?.label, fromIdx, toIdx }); } catch { }
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onAddMain={(label: string) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    mains.push({ label, subData: [] });
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onRenameMain={(mIdx: number, label: string) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    if (!mains[mIdx]) return prev;
                    mains[mIdx].label = label;
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onDeleteMain={(mIdx: number) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    if (mIdx < 0 || mIdx >= mains.length) return prev;
                    mains.splice(mIdx, 1);
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onAddSub={(mIdx: number, label: string) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    const main = mains[mIdx];
                    if (!main) return prev;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    list.push({ label, required: true });
                    main.subData = list;
                    mains[mIdx] = main;
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onRenameSub={(mIdx: number, sIdx: number, label: string) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    const main = mains[mIdx];
                    if (!main) return prev;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= list.length) return prev;
                    list[sIdx] = { ...(list[sIdx] || {}), label };
                    main.subData = list;
                    mains[mIdx] = main;
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onDeleteSub={(mIdx: number, sIdx: number) => {
                  setLocalDDT((prev: any) => {
                    if (!prev) return prev;
                    const next = JSON.parse(JSON.stringify(prev));
                    const mains = getMainDataList(next);
                    const main = mains[mIdx];
                    if (!main) return prev;
                    const list = Array.isArray(main.subData) ? main.subData : [];
                    if (sIdx < 0 || sIdx >= list.length) return prev;
                    list.splice(sIdx, 1);
                    main.subData = list;
                    mains[mIdx] = main;
                    next.mainData = mains;
                    try { replaceSelectedDDT(next); } catch { }
                    return next;
                  });
                }}
                onSelectAggregator={handleSelectAggregator}
              />
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Steps toolbar hidden during NLP editor or MessageReview */}
              {!showSynonyms && !showMessageReview && (
                <div style={{ borderBottom: '1px solid #1f2340', background: '#0f1422' }}>
                  <StepsStrip
                    stepKeys={uiStepKeys}
                    selectedStepKey={selectedStepKey}
                    onSelectStep={setSelectedStepKey}
                    node={selectedNode}
                  />
                </div>
              )}
              {/* Content */}
              <div style={{ display: 'flex', minHeight: 0, flex: 1, maxHeight: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxHeight: '100%', padding: showMessageReview ? '16px' : '16px 16px 0 16px' }}>
                  {showMessageReview ? (
                    <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        <MessageReviewView node={selectedNode} translations={localTranslations} updateSelectedNode={updateSelectedNode} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {showSynonyms ? (
                          <div style={{ padding: 12, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <NLPExtractorProfileEditor
                              node={selectedNode}
                              actType={actType}
                              locale={'it-IT'}
                              intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining || undefined : undefined}
                              act={act}
                              onChange={(profile) => {
                                // Only log if debug flag is set to avoid console spam
                                try {
                                  if (localStorage.getItem('debug.responseEditor') === '1') {
                                    console.log('[KindChange][onChange]', {
                                      nodeLabel: (selectedNode as any)?.label,
                                      profileKind: profile?.kind,
                                      examples: (profile?.examples || []).length,
                                      testCases: (profile?.testCases || []).length,
                                    });
                                  }
                                } catch { }


                                // ✅ Usa handleProfileUpdate invece di updateSelectedNode
                                handleProfileUpdate({
                                  ...profile,
                                  // Assicura che kind e synonyms siano aggiornati anche in node root
                                  ...(profile.kind && profile.kind !== 'auto' ? { _kindManual: profile.kind } : {}),
                                });
                              }}
                            />
                          </div>
                        ) : (
                          <StepEditor
                            node={selectedNode}
                            stepKey={selectedStepKey}
                            translations={localTranslations}
                            onModelChange={normalizeAndPersistModel}
                            onDeleteEscalation={(idx) => updateSelectedNode((node) => {
                              const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
                              const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
                              st.escalations = (st.escalations || []).filter((_: any, i: number) => i !== idx);
                              next.steps[selectedStepKey] = st;
                              return next;
                            })}
                            onDeleteAction={(escIdx, actionIdx) => updateSelectedNode((node) => {
                              const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
                              const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
                              const esc = (st.escalations || [])[escIdx];
                              if (!esc) return next;
                              esc.actions = (esc.actions || []).filter((_: any, j: number) => j !== actionIdx);
                              st.escalations[escIdx] = esc;
                              next.steps[selectedStepKey] = st;
                              return next;
                            })}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {!showSynonyms && !showMessageReview && (
                  <RightPanel
                    mode={rightMode}
                    width={rightWidth}
                    onWidthChange={setRightWidth}
                    onStartResize={() => setDragging(true)}
                    dragging={dragging}
                    ddt={localDDT}
                    translations={localTranslations}
                    selectedNode={selectedNode}
                    onUpdateDDT={(updater) => {
                      setLocalDDT((prev: any) => {
                        const updated = updater(prev);
                        try { replaceSelectedDDT(updated); } catch { }
                        // Force re-render by returning a new object reference
                        // The deep copy in updateActionTextInDDT should already ensure this,
                        // but this makes it explicit
                        return updated;
                      });
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drag layer for visual feedback when dragging actions */}
      <ActionDragLayer />
    </div>
  );
}

export default function ResponseEditor({ ddt, onClose, onWizardComplete, act, hideHeader, onToolbarUpdate }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string; instanceId?: string }, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void }) {
  return (
    <FontProvider>
      <ResponseEditorInner ddt={ddt} onClose={onClose} onWizardComplete={onWizardComplete} act={act} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} />
    </FontProvider>
  );
}