import React from 'react';
import ActionList from '../ActionViewer/ActionList';
import { Plus } from 'lucide-react';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import ConstraintWizard from '../../ConstraintGenerator/ConstraintWizard';
import { createConstraint, updateConstraint, removeConstraint } from './constraintFactories';
import { AlertTriangle } from 'lucide-react';
import ResponseEditorHeader from './ResponseEditorHeader';
import StepStrip from './StepStrip';

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
      <ResponseEditorHeader
        ddt={props.editorState.ddt}
        selectedNodeIndex={props.selectedNodeIndex}
        onSelectNode={props.onSelectNode || (() => {})}
        showLabel={props.editorState.showLabel}
        onShowLabelChange={props.editorState.onShowLabelChange}
        onAddConstraint={() => setShowConstraintWizard(true)}
        getDDTIcon={props.getDDTIcon}
        onClose={props.onClose}
      />
      <StepStrip
        steps={props.stepKeys}
        stepMeta={props.stepMeta}
        selectedStep={props.editorState.selectedStep}
        onStepChange={props.editorState.onStepChange}
      />
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