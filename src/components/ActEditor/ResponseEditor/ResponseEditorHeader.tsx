import React from 'react';
import { Play, Square } from 'lucide-react';
import SmartTooltip from '../../SmartTooltip';
import { TooltipWrapper } from '../../TooltipWrapper';
import EditorHeader from '../../common/EditorHeader';

interface ResponseEditorHeaderProps {
  ddt: any;
  selectedNodeIndex: number | null;
  onSelectNode: (index: number | null) => void;
  showLabel: boolean;
  onShowLabelChange: (checked: boolean) => void;
  onAddConstraint: () => void;
  getDDTIcon?: (type: string) => React.ReactNode;
  onClose: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleSimulator?: () => void;
  showSimulator?: boolean;
}

const ResponseEditorHeader: React.FC<ResponseEditorHeaderProps> = ({
  ddt,
  selectedNodeIndex,
  onSelectNode,
  showLabel,
  onShowLabelChange,
  onAddConstraint,
  getDDTIcon,
  onClose,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  onToggleSimulator,
  showSimulator,
}) => {
  return (
    <EditorHeader
      title="Response Editor"
      color="purple"
      rightActions={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={showLabel}
              onChange={(e) => onShowLabelChange(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span style={{ color: 'white', fontSize: 12 }}>Mostra label azione</span>
          </div>
          <button
            onClick={onAddConstraint}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: 6,
              padding: '4px 12px',
              color: 'white',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            + Aggiungi constraint
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.35)',
              color: 'white',
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Chiudi
          </button>
        </div>
      )}
      style={{ borderRadius: 10, marginBottom: 8 }}
    >
      {/* MainData and SubData buttons */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {/* MainData button with SmartTooltip (icon expands on click) */}
        <SmartTooltip
          text={`"${ddt?.label || '—'}" è composto da più elementi.\nPer considerare questo dato completo, tutti i sotto-dati a destra (selezionati) devono essere acquisiti.`}
          tutorId={"mainData_subdata"}
        >
          <button
            onClick={() => onSelectNode(null)}
            style={{
              fontWeight: selectedNodeIndex == null ? 800 : 600,
              background: selectedNodeIndex == null ? '#f3e8ff' : '#a21caf',
              color: selectedNodeIndex == null ? '#a21caf' : '#fff',
              border: selectedNodeIndex == null ? '2px solid #fff' : '2px solid #a21caf',
              borderRadius: 6,
              padding: '6px 18px',
              fontSize: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: selectedNodeIndex == null ? '0 0 0 2px #fff8' : undefined,
              outline: 'none',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            {getDDTIcon && getDDTIcon(ddt?.type)}
            {ddt?.label || '—'}
          </button>
        </SmartTooltip>
        {/* SubData buttons */}
        {Array.isArray(ddt?.mainData?.subData) && ddt.mainData.subData.length > 0 && (
          <span style={{ fontSize: 18, color: '#fff', fontWeight: 700, margin: '0 4px' }}>(</span>
        )}
        {Array.isArray(ddt?.mainData?.subData) && ddt.mainData.subData.map((sub: any, i: number) => (
          <SmartTooltip
            key={i}
            text={`Clicca qui per vedere come viene gestito il dato \"${sub.label || `Sub ${i+1}` }\".\nPotrai esplorare domanda, validazione e messaggi di recovery associati.`}
            tutorId={`subdata_${i}`}
          >
            <button
              onClick={() => onSelectNode(i)}
              style={{
                fontWeight: selectedNodeIndex === i ? 800 : 600,
                background: selectedNodeIndex === i ? '#ede9fe' : '#a78bfa',
                color: selectedNodeIndex === i ? '#a21caf' : '#fff',
                border: selectedNodeIndex === i ? '2px solid #fff' : '2px solid #a78bfa',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 15,
                marginLeft: 2,
                marginRight: 2,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                boxShadow: selectedNodeIndex === i ? '0 0 0 2px #fff8' : undefined,
                outline: 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
            >
              {sub.label || `Sub ${i+1}`}
            </button>
          </SmartTooltip>
        ))}
        {Array.isArray(ddt?.mainData?.subData) && ddt.mainData.subData.length > 0 && (
          <span style={{ fontSize: 18, color: '#fff', fontWeight: 700, margin: '0 4px' }}>)</span>
        )}
      </span>
      
      {/* Simulator and Undo/Redo buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Simulator button */}
        {onToggleSimulator && (
          <button 
            onClick={onToggleSimulator} 
            style={{ 
              padding: '4px 10px', 
              borderRadius: 4, 
              border: '1px solid rgba(255,255,255,0.3)', 
              background: showSimulator ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.2)', 
              color: 'white', 
              fontWeight: 600, 
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            title={showSimulator ? 'Stop simulation' : 'Test flow simulation'}
          >
            {showSimulator ? <Square size={14} /> : <Play size={14} />}
            {showSimulator ? 'Stop' : 'Test'}
          </button>
        )}
        
        <button 
          onClick={handleUndo} 
          disabled={!canUndo} 
          style={{ 
            padding: '4px 10px', 
            borderRadius: 4, 
            border: '1px solid rgba(255,255,255,0.3)', 
            background: canUndo ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', 
            color: canUndo ? 'white' : 'rgba(255,255,255,0.5)', 
            fontWeight: 600, 
            cursor: canUndo ? 'pointer' : 'not-allowed',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          ↶ Undo
        </button>
        <button 
          onClick={handleRedo} 
          disabled={!canRedo} 
          style={{ 
            padding: '4px 10px', 
            borderRadius: 4, 
            border: '1px solid rgba(255,255,255,0.3)', 
            background: canRedo ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', 
            color: canRedo ? 'white' : 'rgba(255,255,255,0.5)', 
            fontWeight: 600, 
            cursor: canRedo ? 'pointer' : 'not-allowed',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          ↷ Redo
        </button>
      </div>
      
    </EditorHeader>
  );
};

export default ResponseEditorHeader; 