import React, { useState, useMemo, useEffect, useRef } from 'react';
import { info } from '../../../utils/logger';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import { instanceRepository } from '../../../services/InstanceRepository';
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
import { useNodeSelection } from './hooks/useNodeSelection';
import { useNodeUpdate } from './hooks/useNodeUpdate';
import { useNodePersistence } from './hooks/useNodePersistence';
import { useDDTInitialization } from './hooks/useDDTInitialization';
import { useResponseEditorToolbar } from './ResponseEditorToolbar';

export default function ResponseEditor({ ddt, onClose, onWizardComplete, act }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string } }) {
  // Ottieni projectId corrente per salvare le istanze nel progetto corretto
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  // Font zoom (Ctrl+wheel) like sidebar
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 24;
  const DEFAULT_FONT_SIZE = 16;
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const rootRef = useRef<HTMLDivElement>(null);
  const fontScale = useMemo(() => Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize)) / DEFAULT_FONT_SIZE, [fontSize]);
  const wizardOwnsDataRef = useRef(false); // Flag: wizard has control over data lifecycle

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
  const [localTranslations, setLocalTranslations] = useState<any>({ ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) });

  // Synchronize translations when DDT changes
  useEffect(() => {
    const nextTranslations = { ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) };
    setLocalTranslations((prev: any) => {
      const same = JSON.stringify(prev) === JSON.stringify(nextTranslations);
      return same ? prev : nextTranslations;
    });
    try {
      const counts = {
        ide: ideTranslations ? Object.keys(ideTranslations).length : 0,
        data: dataDialogueTranslations ? Object.keys(dataDialogueTranslations).length : 0,
        ddt: ddt?.translations?.en ? Object.keys(ddt.translations.en).length : (ddt?.translations ? Object.keys(ddt.translations).length : 0),
        merged: localTranslations ? Object.keys(localTranslations).length : 0,
      };
      // Removed verbose logs - gated by localStorage
    } catch { }
    // include localDDT in deps to compare ids; avoid resetting selection for same DDT updates
  }, [ddt, mergedBase, localDDT?.id, localDDT?._id]);

  // Persist explicitly on close only (avoid side-effects/flicker on unmount)
  const handleEditorClose = React.useCallback(() => {

    try {
      // Se abbiamo un instanceId o act.id (caso DDTHostAdapter), salva nell'istanza
      if (act?.id || (act as any)?.instanceId) {
        const key = ((act as any)?.instanceId || act?.id) as string;
        const saved = instanceRepository.updateDDT(key, localDDT, currentProjectId || undefined);

        // Fallback: salva anche nel provider globale se l'istanza non esiste
        if (!saved) {
          // Instance save failed, using global provider fallback
        }
      }

      // NON chiamare replaceSelectedDDT se abbiamo act prop (siamo in ActEditorOverlay)
      // Questo previene l'apertura di ResizableResponseEditor in AppContent mentre si chiude ActEditorOverlay
      if (!act) {
        // Modalità diretta (senza act): aggiorna selectedDDT per compatibilità legacy
        replaceSelectedDDT(localDDT);
      }
    } catch (e) {
      console.error('ResponseEditor persist error:', e);
    }

    try { onClose && onClose(); } catch { }
  }, [localDDT, replaceSelectedDDT, onClose, act?.id, (act as any)?.instanceId]);

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
  // Wizard/general layout flags
  const [showWizard, setShowWizard] = useState<boolean>(() => isDDTEmpty(localDDT));

  // Header: icon, title, and toolbar
  const actType = (act?.type || 'DataRequest') as any;
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
    const empty = isDDTEmpty(localDDT);

    if (empty && !wizardOwnsDataRef.current) {
      // DDT is empty → open wizard and take ownership
      setShowWizard(true);
      wizardOwnsDataRef.current = true;
      try {
        info('RESPONSE_EDITOR', 'Wizard ON (DDT empty)', { mains: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0 });
      } catch { }
    } else if (!empty && wizardOwnsDataRef.current) {
      // DDT is complete and wizard had ownership → close wizard and release ownership
      // Removed verbose log
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
      try {
        info('RESPONSE_EDITOR', 'Wizard OFF (DDT filled)', { mains: Array.isArray(localDDT?.mainData) ? localDDT.mainData.length : 0 });
      } catch { }
    }
  }, [localDDT]);

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

  const handleWheelFontZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setFontSize(prev => {
        const next = prev + (e.deltaY < 0 ? 1 : -1);
        return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
      });
    }
  };

  // Attach non-passive wheel listener to block browser zoom and adjust only editor font
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) {
        ev.preventDefault();
        setFontSize(prev => {
          const next = prev + (ev.deltaY < 0 ? 1 : -1);
          return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
        });
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false } as any);
    return () => node.removeEventListener('wheel', onWheel as any);
  }, []);

  // Layout
  return (
    <div ref={rootRef} style={{ height: '100%', background: '#0b0f17', display: 'flex', flexDirection: 'column', fontSize: `${fontSize}px`, zoom: fontScale as unknown as string }} onKeyDown={handleGlobalKeyDown} onWheel={handleWheelFontZoom}>

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
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showWizard ? (
          /* Full-screen wizard without RightPanel */
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DDTWizard
              initialDDT={localDDT}
              onCancel={onClose || (() => { })}
              onComplete={(finalDDT) => {
                const coerced = coercePhoneKind(finalDDT);

                // Set flag to prevent auto-reopen
                wizardOwnsDataRef.current = true;

                // Update local DDT state first (ALWAYS do this)
                setLocalDDT(coerced);
                try {
                  replaceSelectedDDT(coerced);
                } catch (err) {
                  console.error('[WIZARD_FLOW] ResponseEditor: replaceSelectedDDT FAILED', err);
                }

                // Release ownership after a brief delay
                setTimeout(() => {
                  wizardOwnsDataRef.current = false;
                }, 100);

                // Close wizard and reset UI to show StepEditor (ALWAYS do this)
                setShowWizard(false);
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
        ) : (
          /* Normal editor layout with 3 panels (no header, already shown above) */
          <>
            {/* Always visible left navigation */}
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
              <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: showMessageReview ? '16px' : '16px 16px 0 16px' }}>
                  {showMessageReview ? (
                    <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        <MessageReviewView node={selectedNode} translations={localTranslations} updateSelectedNode={updateSelectedNode} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        {showSynonyms ? (
                          <div style={{ padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 }}>
                              <h4 style={{ margin: 0 }}>Data Extractor: {selectedNode?.label || ''}</h4>
                            </div>
                            <NLPExtractorProfileEditor
                              node={selectedNode}
                              locale={'it-IT'}
                              onChange={(profile) => {
                                // Always log critical kind changes to diagnose persistence
                                console.log('[KindChange][onChange]', {
                                  nodeLabel: (selectedNode as any)?.label,
                                  profileKind: profile?.kind,
                                  examples: (profile?.examples || []).length,
                                });
                                updateSelectedNode((node) => {
                                  const next: any = { ...(node || {}), nlpProfile: profile };
                                  if (profile.kind && profile.kind !== 'auto') { next.kind = profile.kind; (next as any)._kindManual = profile.kind; }
                                  if (Array.isArray(profile.synonyms)) next.synonyms = profile.synonyms;
                                  return next;
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