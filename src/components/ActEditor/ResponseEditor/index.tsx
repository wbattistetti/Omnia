import React, { useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import DDTHeader from './DDTHeader';
import { Undo2, Redo2, Plus } from 'lucide-react';
import StepsStrip from './StepsStrip';
import NodeViewer from './NodeViewer';
import {
  getMainDataList,
  getSubDataList,
  getNodeSteps,
  getLabel,
  hasMultipleMains,
  findNode
} from './ddtSelectors';

export default function ResponseEditor({ ddt }: { ddt: any }) {
  const mainList = useMemo(() => getMainDataList(ddt), [ddt]);
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
          <NodeViewer node={selectedNode} stepKey={selectedStepKey} translations={(ddt?.translations && (ddt.translations.en || ddt.translations)) || {}} />
        </div>
      </div>
    </div>
  );
} 