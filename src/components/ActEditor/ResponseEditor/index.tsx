import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import DDTHeader from './DDTHeader';
import { Undo2, Redo2, Plus } from 'lucide-react';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
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
  const [localTranslations, setLocalTranslations] = useState<any>((ddt?.translations && (ddt.translations.en || ddt.translations)) || {});

  useEffect(() => {
    setLocalDDT(ddt);
    setLocalTranslations((ddt?.translations && (ddt.translations.en || ddt.translations)) || {});
  }, [ddt]);

  const mainList = useMemo(() => getMainDataList(localDDT), [localDDT]);
  const [selectedMainIndex, setSelectedMainIndex] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | null>(null);

  // Nodo selezionato: main o sub
  const selectedNode = useMemo(() => {
    const main = mainList[selectedMainIndex];
    if (!main) return null;
    if (selectedSubIndex == null) return main;
    const subList = getSubDataList(main);
    return subList[selectedSubIndex] || null;
  }, [mainList, selectedMainIndex, selectedSubIndex]);

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
    // stepKey sarà aggiornato dall'useEffect
  };

  // Callback per Header
  const handleSelectMainHeader = () => {
    setSelectedSubIndex(null);
    // stepKey sarà aggiornato dall'useEffect
  };
  const handleSelectSub = (idx: number) => {
    setSelectedSubIndex(idx);
    // stepKey sarà aggiornato dall'useEffect
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
  };

  // Layout
  return (
    <div style={{ display: 'flex', height: '100%', background: '#faf7ff' }}>
      {hasMultipleMains(ddt) && (
        <Sidebar
          mainList={mainList}
          selectedMainIndex={selectedMainIndex}
          onSelectMain={handleSelectMain}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header bar arancione con pill main/sub e comandi */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f59e0b1a', background: '#0b1220' }}>
          <div style={{ flex: 1 }}>
            <DDTHeader
              main={mainList[selectedMainIndex]}
              subList={getSubDataList(mainList[selectedMainIndex])}
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
          </div>
        </div>
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
    </div>
  );
} 