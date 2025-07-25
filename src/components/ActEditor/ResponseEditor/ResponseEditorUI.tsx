import React from 'react';
import ActionList from '../ActionViewer/ActionList';
import { Plus } from 'lucide-react';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import ConstraintWizard from '../../ConstraintGenerator/ConstraintWizard';

export interface ResponseEditorUIProps {
  editorState: any;
  filteredNodes: any[];
  stepKeys: string[];
  stepMeta: any;
  handleDrop: (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => void;
  removeNode: (id: string) => void;
  handleAddEscalation: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getDDTIcon: (ddtType: string) => React.ReactNode;
  onClose: () => void;
  onToggleInclude: (id: string, included: boolean) => void;
  onAddConstraint?: (constraint: any) => void;
  constraints?: any[];
  variable?: string;
  type?: string;
}

const ResponseEditorUI: React.FC<ResponseEditorUIProps> = (props) => {
  const [showConstraintWizard, setShowConstraintWizard] = React.useState(false);

  return (
    <div className={styles.responseEditorRoot}>
      {/* Header DDT con icona e label */}
      <div
        style={{
          background: '#a21caf',
          color: '#fff',
          padding: '10px 0 10px 32px',
          textAlign: 'left',
          fontWeight: 700,
          fontSize: 18,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          marginBottom: 12,
          letterSpacing: 0.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12,
          position: 'relative'
        }}
      >
        {props.getDDTIcon(props.editorState.ddtType)}
        <span style={{ fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.2 }}>
          {props.editorState.ddtLabel}
        </span>
        {props.onClose && (
          <button
            onClick={props.onClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 16,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 22,
              fontWeight: 700,
              cursor: 'pointer',
              zIndex: 10
            }}
            title="Chiudi editor"
          >
            ✕
          </button>
        )}
      </div>
      {/* Bottone di chiusura in alto a destra */}
      {props.onClose && (
        <button
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
          onClick={props.onClose}
          title="Chiudi editor"
        >
          ✕
        </button>
      )}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 15, marginRight: 8 }}>Il Bot:</span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {props.stepKeys.filter((step: string) => step !== 'notAcquired').map((step: string) => {
              const meta = props.stepMeta[step] || { icon: null, label: step, border: '#888', bg: 'rgba(100,100,100,0.08)', color: '#888', bgActive: 'rgba(100,100,100,0.18)' };
              const isActive = props.editorState.selectedStep === step;
              // Colore più carico per tab attiva
              const activeBg = isActive ? (meta.bgActive || 'rgba(59,130,246,0.28)') : 'transparent';
              return (
                <button
                  key={step}
                  onClick={() => props.editorState.onStepChange(step)}
                  className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
                  style={{
                    border: `1.5px solid ${meta.border}`,
                    background: activeBg,
                    color: meta.color,
                    borderRadius: 999,
                    padding: '3px 16px',
                    fontSize: 15,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: isActive ? `0 0 0 2px ${meta.border}33` : undefined,
                    outline: 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#555' }}>
              <input type="checkbox" checked={props.editorState.showLabel} onChange={e => props.editorState.onShowLabelChange(e.target.checked)} style={{ marginRight: 4 }} />
              Mostra label azione
            </label>
          </span>
          <button
            onClick={() => setShowConstraintWizard(true)}
            style={{ marginLeft: 16, background: '#a21caf', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}
          >
            + Aggiungi constraint
          </button>
        </div>
      </div>
      {/* Lista constraint */}
      {props.constraints && props.constraints.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Constraint attivi:</h4>
          <ul style={{ color: '#fbbf24', fontSize: 15 }}>
            {props.constraints.map((c, i) => (
              <li key={c.id || i}><b>{c.title}</b> — <span style={{ color: '#cbd5e1' }}>{c.explanation}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
        <div style={{ flex: 2, minWidth: 0, padding: 16 }}>
          {/* Undo/Redo controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={props.handleUndo} disabled={!props.canUndo} style={{ padding: '4px 14px', borderRadius: 6, border: '1.5px solid #888', background: props.canUndo ? '#fff' : '#eee', color: props.canUndo ? '#111' : '#aaa', fontWeight: 700, cursor: props.canUndo ? 'pointer' : 'not-allowed' }}>↶ Undo</button>
            <button onClick={props.handleRedo} disabled={!props.canRedo} style={{ padding: '4px 14px', borderRadius: 6, border: '1.5px solid #888', background: props.canRedo ? '#fff' : '#eee', color: props.canRedo ? '#111' : '#aaa', fontWeight: 700, cursor: props.canRedo ? 'pointer' : 'not-allowed' }}>↷ Redo</button>
          </div>
          <TreeView
            nodes={props.filteredNodes}
            onDrop={props.handleDrop}
            onRemove={props.removeNode}
            onAddEscalation={props.handleAddEscalation}
            onToggleInclude={(id: string) => {
              // Trova il nodo corrente per ricavare lo stato attuale di included
              const node = props.filteredNodes.find(n => n.id === id);
              const currentIncluded = node && typeof node.included === 'boolean' ? node.included : true;
              props.onToggleInclude(id, !currentIncluded);
            }}
            stepKey={props.editorState.selectedStep}
            foreColor={props.stepMeta[props.editorState.selectedStep]?.color || '#ef4444'}
            bgColor={props.stepMeta[props.editorState.selectedStep]?.bg || 'rgba(239,68,68,0.08)'}
          />
          {/* Bottone aggiungi escalation in fondo se ci sono escalation visibili */}
          {props.handleAddEscalation && props.filteredNodes.some(n => n.type === 'escalation') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              {(() => {
                const stepKey = props.editorState.selectedStep;
                const meta = props.stepMeta[stepKey] || { color: '#ef4444' };
                const isConfirmation = stepKey === 'confirmation';
                return (
                  <button
                    onClick={props.handleAddEscalation}
                    style={{
                      color: meta.color,
                      border: `1.5px solid ${meta.color}`,
                      background: meta.bg || 'rgba(239,68,68,0.08)',
                      borderRadius: 999,
                      padding: '5px 18px',
                      fontWeight: 700,
                      fontSize: 15,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      marginTop: 8
                    }}
                  >
                    <Plus size={18} style={{ marginRight: 6 }} />
                    {isConfirmation ? 'Aggiungi conferma' : 'Aggiungi recovery'}
                  </button>
                );
              })()}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 220, borderLeft: '1px solid #eee', padding: 16, background: '#fafaff' }}>
          {showConstraintWizard ? (
            <ConstraintWizard
              variable={props.variable || 'value'}
              type={props.type || 'string'}
              onSave={c => { setShowConstraintWizard(false); props.onAddConstraint && props.onAddConstraint(c); }}
              onCancel={() => setShowConstraintWizard(false)}
            />
          ) : (
            <>
              <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Azioni disponibili</h3>
              <ActionList />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponseEditorUI; 