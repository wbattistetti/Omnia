import React from 'react';
import ActionList from '../ActionViewer/ActionList';
import { Plus } from 'lucide-react';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import ConstraintWizard from '../../ConstraintGenerator/ConstraintWizard';
import { createConstraint, updateConstraint, removeConstraint } from './constraintFactories';
import { AlertTriangle } from 'lucide-react';

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
  onSelectNode?: (index: number | null) => void;
  selectedNodeIndex: number | null;
}

const ResponseEditorUI: React.FC<ResponseEditorUIProps> = (props) => {
  const [showConstraintWizard, setShowConstraintWizard] = React.useState(false);
  const [rightWidth, setRightWidth] = React.useState(360); // 3 colonne (120*3)
  const [dragging, setDragging] = React.useState(false);

  // Log escalations for the selected step of the selected node
  const selectedNode = props.editorState.selectedNode;
  const selectedStep = props.editorState.selectedStep;
  const step = selectedNode && selectedNode.steps ? selectedNode.steps.find((s: any) => s.type === selectedStep) : undefined;
  const escalations = step?.escalations || [];
  console.log('[CHECK] Escalations for step', selectedStep, ':', escalations);

  // Gestione drag splitter
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const totalWidth = window.innerWidth;
      const minRight = 120; // almeno una colonna
      const maxPossible = window.innerWidth - 320; // lascia almeno 320px a sinistra
      const maxRight = Math.min(1440, maxPossible); // massimo tra 12 colonne e spazio disponibile
      const newRightWidth = Math.max(minRight, Math.min(maxRight, totalWidth - e.clientX));
      setRightWidth(newRightWidth);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

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
        {/* Pannellino subdata a sinistra */}
        {(() => {
          // Logga mainData e subdataArr
          const mainLabel = props.editorState.ddt?.label || '—';
          const subdataArr = props.editorState.ddt?.mainData?.subData || [];
          return (
            <div style={{
              width: 180,
              minWidth: 140,
              maxWidth: 220,
              background: 'rgba(37,99,235,0.07)',
              borderRadius: 10,
              marginRight: 18,
              padding: '10px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 0,
              boxShadow: '0 2px 8px #0001',
              overflowY: 'auto',
              height: 'calc(100% - 8px)'
            }}>
              <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 15, textAlign: 'center', marginBottom: 6 }}>Subdata</div>
              {/* Main data root selezionabile */}
              <div
                onClick={() => {
                  if (props.onSelectNode) {
                    props.onSelectNode(null);
                  }
                }}
                style={{
                  fontWeight: props.selectedNodeIndex == null ? 800 : 600,
                  background: props.selectedNodeIndex == null ? '#a21caf' : '#fff',
                  color: props.selectedNodeIndex == null ? '#fff' : '#18181b',
                  cursor: 'pointer',
                  borderRadius: 6,
                  marginBottom: 2,
                  padding: '6px 12px',
                  border: props.selectedNodeIndex == null ? '2px solid #a21caf' : '1px solid #e0e7ef'
                }}
              >
                {mainLabel}
              </div>
              {/* Subdata figli selezionabili */}
              {subdataArr.map((sub: any, i: number) => (
                <div
                  key={sub.id || sub.variable || sub.name || i}
                  onClick={() => {
                    if (props.onSelectNode) {
                      props.onSelectNode(i);
                    }
                  }}
                  style={{
                    fontWeight: props.selectedNodeIndex === i ? 800 : 600,
                    background: props.selectedNodeIndex === i ? '#a21caf' : '#f8fafc',
                    color: props.selectedNodeIndex === i ? '#fff' : '#2563eb',
                    cursor: 'pointer',
                    borderRadius: 6,
                    marginBottom: 2,
                    padding: '6px 28px',
                    border: props.selectedNodeIndex === i ? '2px solid #a21caf' : '1px solid #e0e7ef'
                  }}
                >
                  {sub.label}
                </div>
              ))}
            </div>
          );
        })()}
        <div style={{ flex: 1, minWidth: 320, padding: 16 }}>
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
        {/* Splitter verticale */}
        <div
          style={{ width: 8, cursor: 'col-resize', background: dragging ? '#a21caf33' : 'transparent', zIndex: 10 }}
          onMouseDown={() => setDragging(true)}
        />
        {dragging && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              cursor: 'col-resize'
            }}
          />
        )}
        <div style={{ flex: 'none', minWidth: 120, width: rightWidth, maxWidth: rightWidth, borderLeft: '1px solid #eee', padding: 16, background: '#fafaff', minHeight: 900 }}>
          {showConstraintWizard ? (
            <ConstraintWizard
              variable={props.variable || 'value'}
              type={props.type || 'string'}
              onSave={c => { setShowConstraintWizard(false); props.onAddConstraint && props.onAddConstraint(createConstraint(c)); }}
              onCancel={() => setShowConstraintWizard(false)}
            />
          ) : (
            <>
              <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Azioni disponibili</h3>
              <ActionList />
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onClick={() => setShowConstraintWizard(true)}
                  style={{ background: '#a21caf', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 15, cursor: 'pointer' }}
                >
                  + Aggiungi constraint
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponseEditorUI; 