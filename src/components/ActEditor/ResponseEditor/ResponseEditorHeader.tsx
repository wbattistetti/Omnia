import React from 'react';
import SmartTooltip from '../../SmartTooltip';
import { TooltipWrapper } from '../../TooltipWrapper';

interface ResponseEditorHeaderProps {
  ddt: any;
  selectedNodeIndex: number | null;
  onSelectNode: (index: number | null) => void;
  showLabel: boolean;
  onShowLabelChange: (checked: boolean) => void;
  onAddConstraint: () => void;
  getDDTIcon?: (type: string) => React.ReactNode;
}

const ResponseEditorHeader: React.FC<ResponseEditorHeaderProps> = ({
  ddt,
  selectedNodeIndex,
  onSelectNode,
  showLabel,
  onShowLabelChange,
  onAddConstraint,
  getDDTIcon,
}) => {
  return (
    <div style={{ background: '#a21caf', borderRadius: 10, padding: '8px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 18 }}>
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
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>
          <input type="checkbox" checked={showLabel} onChange={e => onShowLabelChange(e.target.checked)} style={{ marginRight: 4 }} />
          Mostra label azione
        </label>
        <button
          onClick={onAddConstraint}
          style={{ marginLeft: 16, background: '#fff', color: '#a21caf', fontWeight: 700, border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}
        >
          + Aggiungi constraint
        </button>
      </span>
    </div>
  );
};

export default ResponseEditorHeader; 