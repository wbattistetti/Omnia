import React, { useState, useMemo, useEffect } from 'react';
import { useDDTManager } from '../../../context/DDTManagerContext';
import Sidebar from './Sidebar';
import DDTHeader from './DDTHeader';
import { Undo2, Redo2, Plus, MessageSquare, Code2, FileText, Rocket } from 'lucide-react';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
import {
  getMainDataList,
  getSubDataList,
  getNodeSteps,
  getLabel,
  hasMultipleMains,
  findNode
} from './ddtSelectors';

export default function ResponseEditor({ ddt }: { ddt: any }) {
  // Local editable copies
  const [localDDT, setLocalDDT] = useState<any>(ddt);
  const { updateTranslation, ideTranslations, dataDialogueTranslations, setDataDialogueTranslations } = useDDTManager();
  const mergedBase = useMemo(() => ({ ...(ideTranslations || {}), ...(dataDialogueTranslations || {}) }), [ideTranslations, dataDialogueTranslations]);
  const [localTranslations, setLocalTranslations] = useState<any>({ ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) });

  useEffect(() => {
    setLocalDDT(ddt);
    setLocalTranslations({ ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) });
    setSelectedMainIndex(0);
    setSelectedSubIndex(null);
    try {
      const counts = {
        ide: ideTranslations ? Object.keys(ideTranslations).length : 0,
        data: dataDialogueTranslations ? Object.keys(dataDialogueTranslations).length : 0,
        ddt: ddt?.translations?.en ? Object.keys(ddt.translations.en).length : (ddt?.translations ? Object.keys(ddt.translations).length : 0),
        merged: localTranslations ? Object.keys(localTranslations).length : 0,
      };
      console.log('[ResponseEditor] Translation sources counts:', counts);
      const mains = getMainDataList(ddt) || [];
      console.log('[ResponseEditor] DDT label:', ddt?.label, 'mains:', mains.map(m => m?.label));
    } catch {}
  }, [ddt, mergedBase]);

  const mainList = useMemo(() => getMainDataList(localDDT), [localDDT]);
  // Detect aggregated view: many atomic mains (no subData) that should be shown as one main with sub pills
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1 && mainList.every((m: any) => !Array.isArray(m?.subData) || (m.subData || []).length === 0)
  ), [mainList]);
  const [selectedMainIndex, setSelectedMainIndex] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | null>(null);
  const [rightMode, setRightMode] = useState<RightPanelMode>(() => {
    try { return (localStorage.getItem('responseEditor.rightMode') as RightPanelMode) || 'actions'; } catch { return 'actions'; }
  });
  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);
  const [dragging, setDragging] = useState(false);

  // Nodo selezionato: main o sub
  const selectedNode = useMemo(() => {
    if (isAggregatedAtomic) {
      // In aggregated atomic mode, treat mains as sub items of a synthetic aggregator
      const index = selectedSubIndex ?? 0;
      return mainList[index] || null;
    }
    const main = mainList[selectedMainIndex];
    if (!main) return null;
    if (selectedSubIndex == null) return main;
    const subList = getSubDataList(main);
    return subList[selectedSubIndex] || null;
  }, [isAggregatedAtomic, mainList, selectedMainIndex, selectedSubIndex]);

  // Step keys per il nodo selezionato
  const stepKeys = useMemo(() => selectedNode ? getNodeSteps(selectedNode) : [], [selectedNode]);
  const [selectedStepKey, setSelectedStepKey] = useState<string>(stepKeys[0] || '');

  // Aggiorna selectedStepKey quando cambia il nodo selezionato
  React.useEffect(() => {
    setSelectedStepKey(stepKeys[0] || '');
  }, [stepKeys]);

  // Callback per Sidebar
  const handleSelectMain = (idx: number) => {
    setSelectedMainIndex(idx);
    setSelectedSubIndex(null);
  };

  // Callback per Header
  const handleSelectMainHeader = () => {
    // Aggregated: selecting main pill has no direct node; default to first sub
    if (isAggregatedAtomic) {
      setSelectedSubIndex(0);
    } else {
      setSelectedSubIndex(null);
    }
  };
  const handleSelectSub = (idx: number) => {
    setSelectedSubIndex(idx);
  };

  // Editing helpers
  const updateSelectedNode = (updater: (node: any) => any) => {
    setLocalDDT((prev: any) => {
      if (!prev) return prev;
      const copy = JSON.parse(JSON.stringify(prev));
      const mains = getMainDataList(copy);
      const main = mains[selectedMainIndex];
      if (!main) return prev;
      if (selectedSubIndex == null) {
        const updated = updater(main) || main;
        mains[selectedMainIndex] = updated;
      } else {
        const subList = getSubDataList(main);
        const sub = subList[selectedSubIndex];
        if (!sub) return prev;
        const subIdx = (main.subData || []).findIndex((s: any) => s.label === sub.label);
        const updated = updater(sub) || sub;
        main.subData[subIdx] = updated;
      }
      copy.mainData = mains;
      return copy;
    });
  };

  const handleUpdateTranslation = (key: string, value: string) => {
    setLocalTranslations((prev: any) => ({ ...prev, [key]: value }));
    // Propaga anche al DDT selezionato nel context per il salvataggio
    updateTranslation(key, value);
    // Aggiorna anche il dizionario dinamico globale così il rendering usa subito il testo
    setDataDialogueTranslations({ ...dataDialogueTranslations, [key]: value });
  };

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

  const saveRightMode = (m: RightPanelMode) => {
    setRightMode(m);
    try { localStorage.setItem('responseEditor.rightMode', m); } catch {}
  };

  // Layout
  return (
    <div style={{ display: 'flex', height: '100%', background: '#faf7ff' }}>
      {(!isAggregatedAtomic && hasMultipleMains(ddt)) && (
        <Sidebar
          mainList={mainList}
          selectedMainIndex={selectedMainIndex}
          onSelectMain={handleSelectMain}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header bar arancione con pill main/sub e comandi */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #fb923c22', background: '#111827' }}>
          <div style={{ flex: 1 }}>
            <DDTHeader
              main={isAggregatedAtomic ? { label: ddt?.label || 'Data' } : mainList[selectedMainIndex]}
              subList={isAggregatedAtomic ? mainList : getSubDataList(mainList[selectedMainIndex])}
              selectedSubIndex={selectedSubIndex}
              onSelectMain={handleSelectMainHeader}
              onSelectSub={handleSelectSub}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button title="Undo" style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
              <Undo2 size={16} />
            </button>
            <button title="Redo" style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
              <Redo2 size={16} />
            </button>
            <button title="Add constraint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
              <Plus size={16} /> <span>Add constraint</span>
            </button>
            {/* Right panel mode toolbar */}
            <div style={{ marginLeft: 8, display: 'inline-flex', gap: 6 }}>
              <button title="Actions" onClick={() => saveRightMode('actions')} style={{ background: rightMode==='actions' ? '#fb923c' : 'transparent', color: rightMode==='actions' ? '#0b1220' : '#fb923c', border: '1px solid #fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                <Rocket size={16} />
              </button>
              <button title="Validator" onClick={() => saveRightMode('validator')} style={{ background: rightMode==='validator' ? '#fb923c' : 'transparent', color: rightMode==='validator' ? '#0b1220' : '#fb923c', border: '1px solid #fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                <Code2 size={16} />
              </button>
              <button title="Test set" onClick={() => saveRightMode('testset')} style={{ background: rightMode==='testset' ? '#fb923c' : 'transparent', color: rightMode==='testset' ? '#0b1220' : '#fb923c', border: '1px solid #fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                <FileText size={16} />
              </button>
              <button title="Chat" onClick={() => saveRightMode('chat')} style={{ background: rightMode==='chat' ? '#fb923c' : 'transparent', color: rightMode==='chat' ? '#0b1220' : '#fb923c', border: '1px solid #fb923c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                <MessageSquare size={16} />
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <StepsStrip
          stepKeys={stepKeys}
          selectedStepKey={selectedStepKey}
          onSelectStep={setSelectedStepKey}
          node={selectedNode}
            />
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', borderRadius: 16, margin: 16, boxShadow: '0 2px 8px #e0d7f7' }}>
              <StepEditor
                node={selectedNode}
                stepKey={selectedStepKey}
                translations={localTranslations}
                onUpdateTranslation={handleUpdateTranslation}
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
            </div>
          </div>
          <RightPanel
            mode={rightMode}
            width={rightWidth}
            onWidthChange={setRightWidth}
            onStartResize={() => setDragging(true)}
            dragging={dragging}
            ddt={localDDT}
            translations={localTranslations}
            selectedNode={selectedNode}
          />
        </div>
      </div>
    </div>
  );
} 