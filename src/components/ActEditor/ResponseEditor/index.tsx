import React, { useState, useMemo, useEffect, useRef } from 'react';
import { info } from '../../../utils/logger';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { taskRepository } from '../../../services/TaskRepository';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import Sidebar from './Sidebar';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
import MessageReviewView from './MessageReview/MessageReviewView';
// import SynonymsEditor from './SynonymsEditor';
import NLPExtractorProfileEditor from './NLPExtractorProfileEditor';
import EditorHeader from '../../common/EditorHeader';
import { getAgentActVisualsByType } from '../../Flowchart/utils/actVisuals';
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
import { DialogueTemplateService } from '../../../services/DialogueTemplateService';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';

function ResponseEditorInner({ ddt, onClose, onWizardComplete, act }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string } }) {

  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;

  // ✅ Get translations from global table (filtered by project locale)
  const { translations: globalTranslations, getTranslation } = useProjectTranslations();
  // Font centralizzato dal Context
  const { combinedClass } = useFontContext();
  // ✅ AI Provider per inferenza pre-wizard
  const { provider: selectedProvider, model: selectedModel } = useAIProvider();
  const rootRef = useRef<HTMLDivElement>(null);
  const wizardOwnsDataRef = useRef(false); // Flag: wizard has control over data lifecycle
  const [isInferring, setIsInferring] = React.useState(false);
  const [inferenceResult, setInferenceResult] = React.useState<any>(null);
  const inferenceAttemptedRef = React.useRef<string | null>(null); // Track which act.label we've already tried

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
  }, []);
  // Get project language from localStorage (set when project is created/loaded)
  const projectLocale = useMemo<'en' | 'it' | 'pt'>(() => {
    try {
      const saved = localStorage.getItem('project.lang');
      console.log('[RESPONSE_EDITOR][LOCALE] Reading project language from localStorage:', saved);
      if (saved === 'en' || saved === 'it' || saved === 'pt') {
        console.log('[RESPONSE_EDITOR][LOCALE] ✅ Using project locale:', saved);
        return saved;
      }
    } catch (err) {
      console.error('[RESPONSE_EDITOR][LOCALE] Error reading locale:', err);
    }
    console.log('[RESPONSE_EDITOR][LOCALE] ⚠️ Using default locale: it');
    return 'it'; // Default to Italian
  }, []);

  // Get translations for project locale
  const getTranslationsForLocale = (locale: 'en' | 'it' | 'pt', ddtTranslations: any) => {
    console.log('[RESPONSE_EDITOR][TRANSLATIONS] getTranslationsForLocale called', {
      locale,
      hasDDTTranslations: !!ddtTranslations,
      ddtTranslationsType: typeof ddtTranslations,
      ddtTranslationsKeys: ddtTranslations ? Object.keys(ddtTranslations) : [],
      ddtTranslationsStructure: ddtTranslations ? {
        hasEn: !!ddtTranslations.en,
        hasIt: !!ddtTranslations.it,
        hasPt: !!ddtTranslations.pt,
        enKeys: ddtTranslations.en ? Object.keys(ddtTranslations.en).length : 0,
        itKeys: ddtTranslations.it ? Object.keys(ddtTranslations.it).length : 0,
        ptKeys: ddtTranslations.pt ? Object.keys(ddtTranslations.pt).length : 0,
        directKeys: typeof ddtTranslations === 'object' && !ddtTranslations.en && !ddtTranslations.it && !ddtTranslations.pt ? Object.keys(ddtTranslations).length : 0,
        isDirectStructure: typeof ddtTranslations === 'object' && !ddtTranslations.en && !ddtTranslations.it && !ddtTranslations.pt,
        sampleDirectKeys: (typeof ddtTranslations === 'object' && !ddtTranslations.en && !ddtTranslations.it && !ddtTranslations.pt) ? Object.keys(ddtTranslations).slice(0, 5) : []
      } : null,
      // 🔍 ESPANDI per vedere la struttura completa
      fullDDTTranslations: ddtTranslations ? JSON.stringify(ddtTranslations).substring(0, 1000) : null,
      // 🔍 VERIFICA se en ha traduzioni del template
      enTemplateKeys: ddtTranslations?.en ? Object.keys(ddtTranslations.en).filter(k => k.startsWith('template.')).slice(0, 10) : [],
      // 🔍 VERIFICA i valori delle traduzioni en del template
      enTemplateValues: ddtTranslations?.en ? Object.entries(ddtTranslations.en)
        .filter(([k]) => k.startsWith('template.'))
        .slice(0, 5)
        .map(([k, v]) => ({ key: k, value: String(v) })) : []
    });

    if (!ddtTranslations) {
      console.log('[RESPONSE_EDITOR][TRANSLATIONS] No DDT translations, returning mergedBase only');
      return mergedBase;
    }

    // Structure: ddt.translations = { en: {...}, it: {...}, pt: {...} }
    const localeTranslations = ddtTranslations[locale] || ddtTranslations.en || ddtTranslations;

    console.log('[RESPONSE_EDITOR][TRANSLATIONS] 🔍 LOCALE SELECTION', {
      requestedLocale: locale,
      hasRequestedLocale: !!ddtTranslations[locale],
      hasEn: !!ddtTranslations.en,
      hasIt: !!ddtTranslations.it,
      hasPt: !!ddtTranslations.pt,
      selectedLocaleTranslations: localeTranslations ? {
        keysCount: Object.keys(localeTranslations).length,
        sampleKeys: Object.keys(localeTranslations).slice(0, 5),
        runtimeKeysCount: Object.keys(localeTranslations).filter(k => k.startsWith('runtime.')).length,
        templateKeysCount: Object.keys(localeTranslations).filter(k => k.startsWith('template.')).length,
        sampleRuntimeKeys: Object.keys(localeTranslations).filter(k => k.startsWith('runtime.')).slice(0, 3),
        sampleRuntimeValues: Object.entries(localeTranslations)
          .filter(([k]) => k.startsWith('runtime.'))
          .slice(0, 3)
          .map(([k, v]) => ({ key: k, value: String(v).substring(0, 50) }))
      } : null
    });

    // 🔍 DEBUG: Verifica le chiavi runtime specifiche per questo DDT
    const runtimeKeysForThisDDT = localeTranslations ? Object.keys(localeTranslations).filter(k =>
      k.startsWith('runtime.') && k.includes('Time_')
    ).slice(0, 10) : [];

    console.log('[RESPONSE_EDITOR][TRANSLATIONS] Selected translations', {
      locale,
      requestedLocale: locale,
      hasRequestedLocale: !!ddtTranslations[locale],
      hasEn: !!ddtTranslations.en,
      hasIt: !!ddtTranslations.it,
      hasPt: !!ddtTranslations.pt,
      usingLocale: ddtTranslations[locale] ? locale : (ddtTranslations.en ? 'en' : 'direct'),
      localeTranslationsKeys: localeTranslations ? Object.keys(localeTranslations).length : 0,
      sampleKeys: localeTranslations ? Object.keys(localeTranslations).slice(0, 5) : [],
      sampleTranslations: localeTranslations ? Object.entries(localeTranslations).slice(0, 3).map(([k, v]) => ({ key: k, value: String(v).substring(0, 30) })) : [],
      // 🔍 VERIFICA le chiavi runtime per questo DDT
      runtimeKeysForThisDDT: runtimeKeysForThisDDT,
      runtimeTranslationsForThisDDT: runtimeKeysForThisDDT.map(k => ({
        key: k,
        value: localeTranslations ? String(localeTranslations[k] || '').substring(0, 50) : ''
      })),
      // 🔍 ESPANDI per vedere tutte le chiavi caricate
      allTranslationKeys: localeTranslations ? Object.keys(localeTranslations) : [],
      // 🔍 VERIFICA se ci sono chiavi del template
      templateKeys: localeTranslations ? Object.keys(localeTranslations).filter(k => k.startsWith('template.')).slice(0, 10) : [],
      // 🔍 VERIFICA i valori delle traduzioni del template
      templateTranslations: localeTranslations ? Object.entries(localeTranslations)
        .filter(([k]) => k.startsWith('template.'))
        .slice(0, 5)
        .map(([k, v]) => ({ key: k, value: String(v) })) : []
    });

    const result = { ...mergedBase, ...localeTranslations };
    console.log('[RESPONSE_EDITOR][TRANSLATIONS] Final merged translations', {
      mergedBaseKeys: Object.keys(mergedBase).length,
      localeTranslationsKeys: localeTranslations ? Object.keys(localeTranslations).length : 0,
      finalKeys: Object.keys(result).length,
      sampleFinalKeys: Object.keys(result).slice(0, 5),
      // 🔍 VERIFICA se le chiavi del DDT sono presenti nel risultato finale
      ddtKeysInResult: localeTranslations ? Object.keys(localeTranslations).filter(k => k.includes('template.') || k.includes('runtime.')).slice(0, 10) : [],
      // 🔍 VERIFICA i valori delle chiavi runtime (quelle usate dai messaggi)
      runtimeKeys: localeTranslations ? Object.entries(localeTranslations)
        .filter(([k]) => k.includes('runtime.'))
        .slice(0, 5)
        .map(([k, v]) => ({ key: k, value: String(v) })) : []
    });

    return result;
  };

  // ✅ localTranslations now comes from global table (filtered by project locale)
  // ❌ REMOVED: ddt?.translations - translations are now in global table only
  const [localTranslations, setLocalTranslations] = useState<Record<string, string>>(() => {
    // Start with empty - will be populated from global table
    console.log('[RESPONSE_EDITOR][TRANSLATIONS] Initial state from global table', {
      projectLocale,
      globalTranslationsCount: Object.keys(globalTranslations).length
    });
    return {};
  });

  // Extract all GUIDs from DDT structure
  const extractGUIDsFromDDT = (ddt: any): string[] => {
    const guids = new Set<string>();
    const guidSources: Array<{ guid: string; source: string }> = [];

    if (!ddt?.mainData) {
      console.log('[DEBUG][EXTRACT_GUIDS] No mainData in DDT');
      return [];
    }

    const processNode = (node: any, nodeLabel?: string) => {
      // Extract from messages
      if (node.messages) {
        Object.entries(node.messages).forEach(([stepKey, msg]: [string, any]) => {
          if (msg?.textKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.textKey)) {
            guids.add(msg.textKey);
            guidSources.push({ guid: msg.textKey, source: `message.${stepKey}${nodeLabel ? ` (${nodeLabel})` : ''}` });
          }
        });
      }

      // Extract from escalations
      if (node.steps) {
        Object.entries(node.steps).forEach(([stepKey, step]: [string, any]) => {
          if (step.escalations) {
            step.escalations.forEach((esc: any, escIdx: number) => {
              if (esc.actions) {
                esc.actions.forEach((action: any, actionIdx: number) => {
                  const actionInstanceId = action.actionInstanceId;
                  if (actionInstanceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionInstanceId)) {
                    guids.add(actionInstanceId);
                    guidSources.push({ guid: actionInstanceId, source: `action.${stepKey}.esc${escIdx}.act${actionIdx}${nodeLabel ? ` (${nodeLabel})` : ''}` });
                  }
                  const textParam = action.parameters?.find((p: any) => p.parameterId === 'text');
                  if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                    guids.add(textParam.value);
                    guidSources.push({ guid: textParam.value, source: `param.${stepKey}.esc${escIdx}.act${actionIdx}${nodeLabel ? ` (${nodeLabel})` : ''}` });
                  }
                });
              }
            });
          }
        });
      }

      // Recursively process subData
      if (node.subData && Array.isArray(node.subData)) {
        node.subData.forEach((sub: any) => processNode(sub, sub.label || node.label));
      }
    };

    ddt.mainData.forEach((main: any) => processNode(main, main.label));

    const result = Array.from(guids);
    console.log('[DEBUG][EXTRACT_GUIDS] Extracted GUIDs from DDT', {
      totalGuids: result.length,
      guids: result,
      sources: guidSources
    });

    return result;
  };

  // ✅ Update localTranslations from global table when globalTranslations or DDT changes
  // ❌ REMOVED: Loading from database - translations are now in global table only
  useEffect(() => {
    if (!localDDT) {
      console.log('[DEBUG][LOAD_TRANSLATIONS] Skipping - no DDT');
      setLocalTranslations({});
      return;
    }

    const guids = extractGUIDsFromDDT(localDDT);
    if (guids.length === 0) {
      console.log('[DEBUG][LOAD_TRANSLATIONS] No GUIDs found in DDT');
      setLocalTranslations({});
      return;
    }

    // ✅ Extract translations from global table (already filtered by project locale)
    const translationsFromGlobal: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];

    guids.forEach(guid => {
      const translation = globalTranslations[guid];
      if (translation) {
        translationsFromGlobal[guid] = translation;
        foundGuids.push(guid);
      } else {
        missingGuids.push(guid);
      }
    });

    console.log('[DEBUG][LOAD_TRANSLATIONS] ✅ Loaded from global table', {
      requestedGuids: guids.length,
      uniqueGuids: [...new Set(guids)].length,
      foundTranslations: foundGuids.length,
      missingGuids: missingGuids.length,
      projectLocale,
      sampleFound: foundGuids.slice(0, 5),
      sampleMissing: missingGuids.slice(0, 5),
      globalTableSize: Object.keys(globalTranslations).length
    });

    setLocalTranslations(translationsFromGlobal);
  }, [globalTranslations, localDDT?.id, localDDT?._id, projectLocale]);

  // ❌ REMOVED: Sync from ddt.translations - translations are now in global table only
  // Translations are updated via the effect above that watches globalTranslations

  // FIX: Salva modifiche quando si clicca "Salva" nel progetto (senza chiudere l'editor)
  React.useEffect(() => {
    const handleProjectSave = () => {
      if (act?.id || (act as any)?.instanceId) {
        const key = ((act as any)?.instanceId || act?.id) as string;
        taskRepository.updateTaskValue(key, { ddt: localDDT }, currentProjectId || undefined);
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [localDDT, act?.id, (act as any)?.instanceId, currentProjectId]);

  // Persist explicitly on close only (avoid side-effects/flicker on unmount)
  const handleEditorClose = React.useCallback(() => {

    try {
      // Se abbiamo un instanceId o act.id (caso DDTHostAdapter), salva nell'istanza
      if (act?.id || (act as any)?.instanceId) {
        const key = ((act as any)?.instanceId || act?.id) as string;
        taskRepository.updateTaskValue(key, { ddt: localDDT }, currentProjectId || undefined);

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
    return isDDTEmpty(localDDT);
  });
  const { Icon, color: iconColor } = getAgentActVisualsByType(actType, !!localDDT);
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

  useEffect(() => {
    console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ════════════════════════════════════════');
    console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] 🎯 Starting wizard logic check', {
      timestamp: new Date().toISOString(),
      hasAct: !!act,
      actLabel: act?.label,
      actType: act?.type,
      actId: act?.id
    });

    // ✅ Se kind === "intent" non deve mostrare il wizard
    const firstMain = mainList[0];
    if (firstMain?.kind === 'intent') {
      console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ⏭️ Skipping wizard (kind === "intent")');
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      return;
    }

    const empty = isDDTEmpty(localDDT);
    console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] 📊 DDT state check', {
      empty,
      wizardOwnsData: wizardOwnsDataRef.current,
      hasLocalDDT: !!localDDT,
      mainsCount: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0,
      mainDataType: typeof localDDT?.mainData,
      isArray: Array.isArray(localDDT?.mainData),
      firstMainSteps: localDDT?.mainData?.[0]?.steps ? Object.keys(localDDT.mainData[0].steps) : [],
      localDDTId: localDDT?.id,
      localDDTLabel: localDDT?.label
    });

    // ✅ IMPORTANTE: Non aprire wizard se l'inferenza è in corso
    if (empty && !wizardOwnsDataRef.current && !isInferring) {
      // ✅ Se c'è act.label, fai inferenza PRIMA di aprire il wizard
      const actLabel = act?.label?.trim();
      const shouldInfer = actLabel && actLabel.length >= 3 && inferenceAttemptedRef.current !== actLabel;

      console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] 📊 Controllo inferenza pre-wizard', {
        hasActLabel: !!actLabel,
        actLabel,
        actLabelLength: actLabel?.length || 0,
        shouldInfer,
        isInferring,
        hasInferenceResult: !!inferenceResult,
        alreadyAttempted: inferenceAttemptedRef.current
      });

      // ✅ PRIMA: Se è in corso l'inferenza, aspetta (NON aprire il wizard ancora)
      if (isInferring) {
        console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ⏳ Aspettando inferenza... (non aprire wizard ancora)', {
          actLabel,
          timestamp: new Date().toISOString()
        });
        // Non fare nulla, aspetta che l'inferenza finisca
        return; // ✅ IMPORTANTE: esci dall'useEffect, non continuare
      }

      // ✅ SECONDO: Se abbiamo già un risultato, apri il wizard direttamente
      if (inferenceResult) {
        console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ✅ Aprendo wizard con risultato inferenza già disponibile', {
          hasInferenceResult: !!inferenceResult,
          timestamp: new Date().toISOString()
        });
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
        try {
          info('RESPONSE_EDITOR', 'Wizard ON (inference result available)', { mains: Array.isArray(inferenceResult?.ai?.schema?.mainData) ? inferenceResult.ai.schema.mainData.length : 0 });
        } catch { }
        return;
      }

      // ✅ TERZO: Se deve inferire E non sta già inferendo E non abbiamo ancora risultato, avvia inferenza
      if (shouldInfer && !inferenceResult) {
        // ✅ Fai inferenza PRIMA di aprire il wizard
        console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] 🚀 Avviando inferenza PRIMA di aprire wizard', {
          actLabel,
          timestamp: new Date().toISOString()
        });
        setIsInferring(true);
        inferenceAttemptedRef.current = actLabel;

        // ✅ Funzione per matching locale (istantaneo, usa cache precaricata)
        const tryLocalPatternMatch = (text: string): any | null => {
          const localMatchStartTime = performance.now();
          try {
            console.log('[RESPONSE_EDITOR][LOCAL_MATCH] 🔍 Tentativo matching locale (cache)...', { text });
            // ✅ Usa cache precaricata (istantaneo, no fetch!)
            const templates = DialogueTemplateService.getAllTemplates();
            if (templates.length === 0) {
              console.log('[RESPONSE_EDITOR][LOCAL_MATCH] ⚠️ Cache non ancora caricata, skip matching locale');
              return null;
            }
            const textLower = text.toLowerCase().trim();

            // ✅ Cerca match con pattern tra TUTTI i template (appiattiti, non importa atomico/composito)
            for (const template of templates) {
              const patterns = template.patterns;
              if (!patterns || typeof patterns !== 'object') continue;

              // Prova IT, EN, PT
              const langPatterns = patterns.IT || patterns.EN || patterns.PT;
              if (!Array.isArray(langPatterns)) continue;

              for (const patternStr of langPatterns) {
                try {
                  const regex = new RegExp(patternStr, 'i');
                  if (regex.test(textLower)) {
                    const localMatchElapsed = performance.now() - localMatchStartTime;
                    console.log('[RESPONSE_EDITOR][LOCAL_MATCH] ✅✅✅ MATCH LOCALE TROVATO!', {
                      templateLabel: template.label || template.name,
                      templateId: template._id || template.id,
                      pattern: patternStr,
                      elapsedMs: Math.round(localMatchElapsed),
                      timestamp: new Date().toISOString()
                    });

                    // ✅ FASE 2: Costruisci istanza DDT dal template
                    // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
                    // quindi può avere tutti i 6 tipi di stepPrompts (start, noMatch, noInput, confirmation, notConfirmed, success).
                    // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
                    // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
                    const subDataIds = template.subDataIds || [];

                    let mainData: any[] = [];

                    if (subDataIds.length > 0) {
                      // ✅ Template composito: crea UN SOLO mainData con subData[] popolato
                      console.log('[RESPONSE_EDITOR][LOCAL_MATCH] 📦 Template composito, creando istanze per sottodati', {
                        subDataIds,
                        count: subDataIds.length
                      });

                      // ✅ PRIMA: Costruisci array di subData instances
                      // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
                      const subDataInstances: any[] = [];

                      for (const subId of subDataIds) {
                        // ✅ Cerca template per ID (può essere _id, id, name, o label)
                        const subTemplate = DialogueTemplateService.getTemplate(subId);
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
                            subData: []
                          });
                        } else {
                          console.warn('[RESPONSE_EDITOR][LOCAL_MATCH] ⚠️ Template sottodato non trovato per ID', { subId });
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
                        subData: subDataInstances // ✅ Sottodati QUI dentro subData[], non in mainData[]
                      };
                      mainData.push(mainInstance); // ✅ UN SOLO elemento in mainData
                    } else {
                      // ✅ Template semplice: crea istanza dal template root
                      console.log('[RESPONSE_EDITOR][LOCAL_MATCH] 📄 Template semplice, creando istanza root');
                      const mainInstance = {
                        label: template.label || template.name || 'Data',
                        type: template.type,
                        icon: template.icon || 'Calendar',
                        stepPrompts: template.stepPrompts || undefined,
                        constraints: template.dataContracts || template.constraints || [],
                        examples: template.examples || [],
                        subData: []
                      };
                      mainData.push(mainInstance);
                    }

                    // ✅ Estrai tutti i GUID dai stepPrompts per il caricamento traduzioni
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

                    console.log('[RESPONSE_EDITOR][LOCAL_MATCH] 🔍 GUID estratti dai stepPrompts:', {
                      totalGuids: allGuids.length,
                      uniqueGuids: [...new Set(allGuids)].length,
                      guids: [...new Set(allGuids)]
                    });

                    console.log('[RESPONSE_EDITOR][LOCAL_MATCH] ✅ Istanza DDT costruita con stepPrompts:', {
                      templateLabel: template.label || template.name,
                      mainDataCount: mainData.length,
                      mainDataWithStepPrompts: mainData.map((m: any) => ({
                        label: m.label,
                        hasStepPrompts: !!m.stepPrompts,
                        stepPromptsKeys: m.stepPrompts ? Object.keys(m.stepPrompts) : [],
                        subDataCount: m.subData?.length || 0,
                        subDataWithStepPrompts: m.subData?.map((s: any) => ({
                          label: s.label,
                          hasStepPrompts: !!s.stepPrompts,
                          stepPromptsKeys: s.stepPrompts ? Object.keys(s.stepPrompts) : []
                        })) || []
                      }))
                    });

                    return {
                      ai: {
                        schema: {
                          label: template.label || template.name || 'Data',
                          mainData: mainData,
                          // Include stepPrompts a livello schema se presente
                          stepPrompts: template.stepPrompts || undefined
                        },
                        icon: template.icon || 'Calendar'
                      }
                    };
                  }
                } catch (e) {
                  // Pattern invalido, skip
                  continue;
                }
              }
            }

            const localMatchElapsed = performance.now() - localMatchStartTime;
            console.log('[RESPONSE_EDITOR][LOCAL_MATCH] ❌ Nessun match locale trovato', {
              elapsedMs: Math.round(localMatchElapsed),
              templatesChecked: templates.length
            });
            return null;
          } catch (error) {
            console.error('[RESPONSE_EDITOR][LOCAL_MATCH] ❌ Errore nel matching locale:', error);
            return null;
          }
        };

        // Chiama l'inferenza
        const performInference = async () => {
          const inferenceStartTime = performance.now();
          try {
            // ✅ PRIMA: Prova matching locale (istantaneo, sincrono, usa cache)
            const localMatch = tryLocalPatternMatch(actLabel);
            if (localMatch) {
              const totalElapsed = performance.now() - inferenceStartTime;
              console.log('[RESPONSE_EDITOR][INFERENCE] ✅✅✅ Inferenza LOCALE completata!', {
                hasAi: !!localMatch.ai,
                hasSchema: !!(localMatch.ai?.schema),
                hasMainData: !!(localMatch.ai?.schema?.mainData && Array.isArray(localMatch.ai.schema.mainData)),
                mainDataLength: localMatch.ai?.schema?.mainData?.length || 0,
                totalElapsedMs: Math.round(totalElapsed),
                timestamp: new Date().toISOString()
              });
              // ✅ FIX: Setta risultato E apri wizard DIRETTAMENTE (non aspettare useEffect)
              setInferenceResult(localMatch);
              setIsInferring(false);
              setShowWizard(true);
              wizardOwnsDataRef.current = true;
              console.log('[RESPONSE_EDITOR][INFERENCE] ✅ Wizard aperto direttamente dopo match locale');
              return; // ✅ Match locale trovato, non chiamare API
            }

            // ✅ SECONDO: Se non c'è match locale, chiama API
            console.log('[RESPONSE_EDITOR][INFERENCE] 📡 Nessun match locale, chiamando API...', {
              userDesc: actLabel,
              provider: selectedProvider.toLowerCase(),
              model: selectedModel,
              timestamp: new Date().toISOString()
            });

            const response = await fetch('/step2-with-provider', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userDesc: actLabel,
                provider: selectedProvider.toLowerCase(),
                model: selectedModel
              }),
            });

            const inferenceElapsed = performance.now() - inferenceStartTime;
            console.log('[RESPONSE_EDITOR][INFERENCE] 📥 Risposta API ricevuta', {
              status: response.status,
              ok: response.ok,
              elapsedMs: Math.round(inferenceElapsed),
              timestamp: new Date().toISOString()
            });

            if (response.ok) {
              const result = await response.json();
              const totalElapsed = performance.now() - inferenceStartTime;
              console.log('[RESPONSE_EDITOR][INFERENCE] ✅✅✅ Inferenza API completata!', {
                hasAi: !!result.ai,
                hasSchema: !!(result.ai?.schema),
                hasMainData: !!(result.ai?.schema?.mainData && Array.isArray(result.ai.schema.mainData)),
                mainDataLength: result.ai?.schema?.mainData?.length || 0,
                totalElapsedMs: Math.round(totalElapsed),
                timestamp: new Date().toISOString()
              });
              // ✅ FIX: Setta risultato E apri wizard DIRETTAMENTE (non aspettare useEffect)
              setInferenceResult(result);
              setShowWizard(true);
              wizardOwnsDataRef.current = true;
              console.log('[RESPONSE_EDITOR][INFERENCE] ✅ Wizard aperto direttamente dopo API');
            } else {
              console.warn('[RESPONSE_EDITOR][INFERENCE] ⚠️ Risposta non OK', {
                status: response.status,
                statusText: response.statusText
              });
            }
          } catch (error) {
            const inferenceElapsed = performance.now() - inferenceStartTime;
            console.error('[RESPONSE_EDITOR][INFERENCE] ❌ Errore nell\'inferenza', {
              error,
              elapsedMs: Math.round(inferenceElapsed),
              timestamp: new Date().toISOString()
            });
          } finally {
            setIsInferring(false);
          }
        };

        performInference();
        return; // ✅ NON aprire il wizard ancora, aspetta il risultato
      }

      // ✅ QUARTO: Se non era necessaria l'inferenza (testo troppo corto o già tentato), apri il wizard
      if (!shouldInfer) {
        console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ✅ Aprendo wizard (nessuna inferenza necessaria)', {
          hasInferenceResult: !!inferenceResult,
          shouldInfer,
          alreadyAttempted: inferenceAttemptedRef.current,
          reason: 'nessuna inferenza necessaria'
        });
        setShowWizard(true);
        wizardOwnsDataRef.current = true;
        try {
          info('RESPONSE_EDITOR', 'Wizard ON (DDT empty, no inference needed)', { mains: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0 });
        } catch { }
      } else {
        console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ⏸️ Aspettando inferenza o risultato...', {
          hasInferenceResult: !!inferenceResult,
          shouldInfer,
          isInferring,
          alreadyAttempted: inferenceAttemptedRef.current
        });
      }
    } else if (!empty && wizardOwnsDataRef.current) {
      // DDT is complete and wizard had ownership → close wizard and release ownership
      console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ✅ Chiudendo wizard (DDT riempito)', {
        mainsCount: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0
      });
      setShowWizard(false);
      // Don't release ownership immediately - let the onComplete handler do it after a delay
      // wizardOwnsDataRef.current = false;
          try {
            info('RESPONSE_EDITOR', 'Wizard OFF (DDT filled)', { mains: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0 });
          } catch { }
        }
    console.log('[RESPONSE_EDITOR][WIZARD_LOGIC] ════════════════════════════════════════');
      }, [localDDT, mainList, act, isInferring, inferenceResult, selectedProvider, selectedModel]); // ✅ Aggiunte dipendenze per inferenza

  // Nodo selezionato: root se selectedRoot, altrimenti main/sub in base agli indici
  const selectedNode = useMemo(() => {
    // If root is selected, return the root DDT structure with introduction step
    if (selectedRoot) {
      if (!localDDT) return null;
      // Always include introduction step (even if empty) so StepEditor can work with it
      const introStep = localDDT.introduction
        ? { type: 'introduction', escalations: localDDT.introduction.escalations }
        : { type: 'introduction', escalations: [] };
      return { ...localDDT, steps: [introStep] };
    }
    const main = mainList[selectedMainIndex];
    if (!main) {
      return null;
    }
    if (selectedSubIndex == null) {
      // Main selected
      // Removed verbose log
      return main;
    }
    const subList = getSubDataList(main);
    const sub = subList[selectedSubIndex] || main;

    // ✅ CRITICAL: Log sub-data structure to verify messages.start
    console.log('🔴 [CRITICAL] SELECTED SUB-DATA NODE', {
      mainLabel: main.label,
      subLabel: sub.label,
      subListLength: subList.length,
      selectedSubIndex,
      subFromList: subList[selectedSubIndex] ? {
        label: subList[selectedSubIndex].label,
        hasSteps: !!subList[selectedSubIndex].steps,
        stepsKeys: subList[selectedSubIndex].steps ? Object.keys(subList[selectedSubIndex].steps) : []
      } : null,
      subReturned: {
        label: sub.label,
        isMain: sub === main,
        hasMessages: !!sub.messages,
        messagesKeys: sub.messages ? Object.keys(sub.messages) : [],
        hasMessagesStart: !!(sub.messages && sub.messages.start),
        messagesStart: sub.messages?.start,
        hasSteps: !!sub.steps,
        stepsKeys: sub.steps ? Object.keys(sub.steps) : [],
        hasStepsStart: !!(sub.steps && sub.steps.start),
        stepsStart: sub.steps?.start
      },
      fullSub: sub
    });

    // DEBUG: Log per verificare la struttura del sub
    const areStepsSameAsMain = main?.steps === sub?.steps;
    const subStartStep = Array.isArray(sub?.steps) ? sub.steps.find((s: any) => s?.type === 'start') : null;
    const mainStartStep = Array.isArray(main?.steps) ? main.steps.find((s: any) => s?.type === 'start') : null;
    const areStartStepsSame = subStartStep === mainStartStep;

    // DEBUG: Get the actual action object to inspect its structure
    const subStartAction = subStartStep?.escalations?.[0]?.actions?.[0];
    const subStartActionKeys = subStartAction ? Object.keys(subStartAction) : [];
    const subStartActionFull = subStartAction ? JSON.stringify(subStartAction).substring(0, 300) : 'null';

    // Removed verbose log

    return sub;
  }, [mainList, selectedMainIndex, selectedSubIndex, selectedRoot, localDDT]);

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


  // Layout
  return (
    <div ref={rootRef} className={combinedClass} style={{ height: '100%', maxHeight: '100%', background: '#0b0f17', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onKeyDown={handleGlobalKeyDown}>

      {/* Header sempre visibile (minimale durante wizard, completo dopo) */}
      <EditorHeader
        icon={<Icon size={18} style={{ color: iconColor }} />}
        title={headerTitle}
        toolbarButtons={toolbarButtons}
        onClose={handleEditorClose}
        color="orange"
      />

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
          /* Mostra loading durante inferenza pre-wizard */
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔮 Inferenza in corso...</div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Analizzando "{act?.label}" per pre-compilare il wizard...</div>
            </div>
          </div>
        ) : showWizard ? (
          /* Full-screen wizard without RightPanel */
          /* ✅ FIX: Non montare wizard se dovrebbe avere inferenceResult ma non ce l'ha ancora */
          (() => {
            // Se abbiamo act.label e dovremmo aver fatto inferenza, aspetta inferenceResult
            const actLabel = act?.label?.trim();
            const shouldHaveInference = actLabel && actLabel.length >= 3;

            if (shouldHaveInference && !inferenceResult) {
              console.log('[RESPONSE_EDITOR][WIZARD] ⏳ Aspettando inferenceResult prima di montare wizard', {
                actLabel,
                hasInferenceResult: !!inferenceResult
              });
              return (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔮 Preparazione wizard...</div>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>Caricamento risultato inferenza...</div>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <DDTWizard
                  initialDDT={inferenceResult?.ai?.schema ? {
                    // ✅ Pre-compila con il risultato dell'inferenza
                    id: localDDT?.id || `temp_ddt_${act?.id}`,
                    label: inferenceResult.ai.schema.label || act?.label || 'Data',
                    mainData: inferenceResult.ai.schema.mainData || [],
                    _inferenceResult: inferenceResult // Passa anche il risultato completo per riferimento
                  } : localDDT}
              onCancel={onClose || (() => { })}
              onComplete={(finalDDT, messages) => {
                console.log('[WIZARD_FLOW] ResponseEditor: onComplete called', {
                  hasFinalDDT: !!finalDDT,
                  ddtId: finalDDT?.id,
                  mainsCount: Array.isArray(finalDDT?.mainData) ? finalDDT.mainData.length : 0,
                  hasMainData: !!finalDDT?.mainData,
                  firstMainSteps: finalDDT?.mainData?.[0]?.steps ? Object.keys(finalDDT.mainData[0].steps) : [],
                  hasMessages: !!messages
                });

                if (!finalDDT) {
                  console.error('[WIZARD_FLOW] ResponseEditor: onComplete called with null/undefined finalDDT');
                  return;
                }

                const coerced = coercePhoneKind(finalDDT);
                console.log('[WIZARD_FLOW] ResponseEditor: DDT coerced', {
                  ddtId: coerced?.id,
                  mainsCount: Array.isArray(coerced?.mainData) ? coerced.mainData.length : 0,
                  isEmpty: isDDTEmpty(coerced)
                });

                // Set flag to prevent auto-reopen
                wizardOwnsDataRef.current = true;

                // Update local DDT state first (ALWAYS do this)
                setLocalDDT(coerced);
                console.log('[WIZARD_FLOW] ResponseEditor: localDDT updated');

                try {
                  replaceSelectedDDT(coerced);
                  console.log('[WIZARD_FLOW] ResponseEditor: replaceSelectedDDT called');
                } catch (err) {
                  console.error('[WIZARD_FLOW] ResponseEditor: replaceSelectedDDT FAILED', err);
                }

                // Close wizard and reset UI to show StepEditor (ALWAYS do this)
                setShowWizard(false);
                console.log('[WIZARD_FLOW] ResponseEditor: wizard closed');

                setRightMode('actions'); // Force show ActionList
                setSelectedStepKey('start'); // Start with first step

                // Release ownership after a delay to allow useEffect to see the new DDT
                // But ensure the DDT is valid first
                setTimeout(() => {
                  const isEmpty = isDDTEmpty(coerced);
                  console.log('[WIZARD_FLOW] ResponseEditor: Checking DDT after delay', {
                    isEmpty,
                    mainsCount: Array.isArray(coerced?.mainData) ? coerced.mainData.length : 0,
                    hasSteps: coerced?.mainData?.[0]?.steps ? Object.keys(coerced.mainData[0].steps).length > 0 : false
                  });

                  if (!isEmpty) {
                    wizardOwnsDataRef.current = false;
                    console.log('[WIZARD_FLOW] ResponseEditor: wizard ownership released (DDT valid)');
                  } else {
                    console.warn('[WIZARD_FLOW] ResponseEditor: DDT still empty after delay, keeping wizard ownership');
                    // Keep wizard open if DDT is still empty
                    setShowWizard(true);
                  }
                }, 300);

                // If parent provided onWizardComplete, notify it after updating UI
                // (but don't close the overlay - let user see the editor)
                if (onWizardComplete) {
                  onWizardComplete(coerced);
                  console.log('[WIZARD_FLOW] ResponseEditor: onWizardComplete callback called');
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
                  // FIX: Salva con projectId per garantire persistenza nel database
                  taskRepository.updateTaskValue(key, { ddt: updatedDDT }, currentProjectId || undefined);

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
                    <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                      <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {showSynonyms ? (
                          <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 }}>
                              <h4 style={{ margin: 0 }}>Data Extractor: {selectedNode?.label || ''}</h4>
                            </div>
                            <NLPExtractorProfileEditor
                              node={selectedNode}
                              actType={actType}
                              locale={'it-IT'}
                              intentSelected={mainList[0]?.kind === 'intent' ? selectedIntentIdForTraining : undefined}
                              act={act}
                              onChange={(profile) => {
                                // Only log if debug flag is set to avoid console spam
                                try {
                                  if (localStorage.getItem('debug.responseEditor') === '1') {
                                    console.log('[KindChange][onChange]', {
                                      nodeLabel: (selectedNode as any)?.label,
                                      profileKind: profile?.kind,
                                      examples: (profile?.examples || []).length,
                                    });
                                  }
                                } catch {}


                                updateSelectedNode((node) => {
                                  const next: any = { ...(node || {}), nlpProfile: profile };
                                  if (profile.kind && profile.kind !== 'auto') { next.kind = profile.kind; (next as any)._kindManual = profile.kind; }
                                  if (Array.isArray(profile.synonyms)) next.synonyms = profile.synonyms;
                                  // Ensure testCases are persisted to node.nlpProfile

                                  return next;
                                });
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            {selectedSubIndex != null && selectedStepKey === 'start' && (() => {
                              // ✅ CRITICAL: Log what we're passing to StepEditor
                              console.log('🔴 [CRITICAL] PASSING TO STEPEDITOR', {
                                selectedSubIndex,
                                selectedStepKey,
                                nodeLabel: selectedNode?.label,
                                nodeHasSteps: !!selectedNode?.steps,
                                nodeStepsKeys: selectedNode?.steps ? Object.keys(selectedNode.steps) : [],
                                nodeHasStepsStart: !!(selectedNode?.steps && selectedNode.steps.start),
                                nodeHasMessages: !!selectedNode?.messages,
                                nodeMessagesKeys: selectedNode?.messages ? Object.keys(selectedNode.messages) : [],
                                nodeHasMessagesStart: !!(selectedNode?.messages && selectedNode.messages.start),
                                fullNode: selectedNode
                              });
                              return null;
                            })()}
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
                          </>
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
                    // DEBUG: Log when passing translations to ResponseSimulator
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                    {...(() => {
                      console.log('[ResponseEditor] Passing translations to ResponseSimulator', {
                        localTranslationsKeys: Object.keys(localTranslations).length,
                        sampleKeys: Object.keys(localTranslations).slice(0, 5),
                        sampleValues: Object.entries(localTranslations).slice(0, 3).map(([k, v]) => ({ key: k, value: String(v).substring(0, 30) }))
                      });
                      return {};
                    })()}
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

export default function ResponseEditor({ ddt, onClose, onWizardComplete, act }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string } }) {
  return (
    <FontProvider>
      <ResponseEditorInner ddt={ddt} onClose={onClose} onWizardComplete={onWizardComplete} act={act} />
    </FontProvider>
  );
}