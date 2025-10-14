import React from 'react';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import ActionList from '../ActionViewer/ActionList';
import { Plus } from 'lucide-react';
import TreeView from './TreeView';
import SynonymsEditor from './SynonymsEditor';
import { BookMarked } from 'lucide-react';
import styles from './ResponseEditor.module.css';
import ConstraintWizard from '../../ConstraintGenerator/ConstraintWizard';
import { createConstraint, updateConstraint, removeConstraint } from './constraintFactories';
import { AlertTriangle } from 'lucide-react';
import StepStrip from './StepStrip';
import ResponseSimulator from './ChatSimulator/ResponseSimulator';

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
  onAIGenerate?: (actionId: string, exampleMessage: string, applyToAll: boolean) => Promise<void>;
  selectedStep?: string;
  onToggleSimulator?: () => void;
  showSimulator?: boolean;
  onWizardComplete?: (ddt: any) => void;
}

const ResponseEditorUI: React.FC<ResponseEditorUIProps> = (props) => {
  const [showConstraintWizard, setShowConstraintWizard] = React.useState(false);
  const [rightWidth, setRightWidth] = React.useState(360); // 3 colonne (120*3)
  const [dragging, setDragging] = React.useState(false);
  const [showSynonyms, setShowSynonyms] = React.useState(false);

  const [localSynonyms, setLocalSynonyms] = React.useState<string[]>([]);

  // Debug logs gated by localStorage flag
  const debugEnabled = React.useMemo(() => {
    try { return localStorage.getItem('debug.response') === '1' || localStorage.getItem('debug.response') === 'true'; } catch { return false; }
  }, []);
  const log = React.useCallback((label: string, payload?: any) => {
    if (!debugEnabled) return;
    try { console.log(`[ResponseEditorUI] ${label}`, payload ?? ''); } catch {}
  }, [debugEnabled]);

  // Wizard visibility under header (left column)
  const [showWizard, setShowWizard] = React.useState<boolean>(() => isDDTEmpty(props.editorState.ddt));
  React.useEffect(() => {
    const empty = isDDTEmpty(props.editorState.ddt);
    setShowWizard(empty);
    log('wizard.init', { empty });
  }, [props.editorState.ddt, log]);

  // Log escalations for the selected step of the selected node
  const selectedNode = props.editorState.selectedNode;
  // Attiva automaticamente il pannello dizionario se richiesto dalla sidebar
  React.useEffect(() => {
    try {
      const flag = sessionStorage.getItem('responseEditor.showSynonyms');
      if (flag === '1') {
        setShowSynonyms(true);
        sessionStorage.removeItem('responseEditor.showSynonyms');
      }
    } catch {}
  }, []);
  const selectedStep = props.editorState.selectedStep;
  const step = selectedNode && selectedNode.steps ? selectedNode.steps.find((s: any) => s.type === selectedStep) : undefined;
  const escalations = step?.escalations || [];

    // Test keyboard shortcuts
    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        
        // Ctrl+Z (undo)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          if (props.canUndo) {
            props.handleUndo();
          }
        }
      };
  
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [props.canUndo, props.handleUndo]);

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
      {/* Header centralizzato rimosso: ogni editor figlio deve renderizzare il proprio header usando EditorHeader */}

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px' }}>
        <button
          title="Dizionario sinonimi"
          onClick={() => setShowSynonyms(s => !s)}
          style={{ marginLeft: 8, border: '1px solid #e5e7eb', background: showSynonyms ? '#eef2ff' : '#fff', color: '#111827', borderRadius: 8, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <BookMarked size={16} />
          Dizionario
        </button>
      </div>
      {/* Grid: left Wizard, right editor (hide right when wizard is visible) */}
      <div style={{ display: 'grid', gridTemplateColumns: showWizard ? 'minmax(540px, 720px)' : 'minmax(420px,520px) 1fr', gap: 12, height: '100%' }}>
        <div style={{ overflow: 'auto', borderRight: '1px solid #1f2340' }}>
          {showWizard && (
            <DDTWizard
              initialDDT={props.editorState.ddt}
              onCancel={() => { log('wizard.cancel'); props.onClose(); }}
              onComplete={(finalDDT) => {
                log('wizard.complete', { hasMainData: !!finalDDT?.mainData, keys: Object.keys(finalDDT || {}).slice(0, 6) });
                setShowWizard(false);
                if (props.onWizardComplete) props.onWizardComplete(finalDDT);
              }}
              startOnStructure={false}
            />
          )}
        </div>
        {!showWizard && (
        <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <StepStrip
            steps={props.stepKeys}
            stepMeta={props.stepMeta}
            selectedStep={props.editorState.selectedStep}
            onStepChange={props.editorState.onStepChange}
          />
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
          {/* Main content area */}
          {showSynonyms ? (
            <SynonymsEditor
              value={localSynonyms}
              onChange={(next) => setLocalSynonyms(next)}
            />
          ) : (
            <TreeView
              nodes={props.filteredNodes}
              onDrop={props.handleDrop}
              onRemove={props.removeNode}
              onAddEscalation={props.handleAddEscalation}
              onToggleInclude={(id: string) => {
                const node = props.filteredNodes.find(n => n.id === id);
                const currentIncluded = node && typeof node.included === 'boolean' ? node.included : true;
                props.onToggleInclude(id, !currentIncluded);
              }}
              stepKey={props.editorState.selectedStep}
              foreColor={props.stepMeta[props.editorState.selectedStep]?.color || '#ef4444'}
              bgColor={props.stepMeta[props.editorState.selectedStep]?.bg || 'rgba(239,68,68,0.08)'}
              onAIGenerate={props.onAIGenerate}
              selectedStep={props.selectedStep}
            />
          )}
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
        <div style={{ flex: 'none', minWidth: 120, width: rightWidth, maxWidth: rightWidth, borderLeft: '1px solid #eee', background: '#fafaff', minHeight: 900 }}>
          {props.showSimulator ? (
            <ResponseSimulator
              ddt={props.editorState.ddt}
              translations={props.editorState.translations}
              selectedNode={props.editorState.selectedNode}
            />
          ) : showConstraintWizard ? (
            <div style={{ padding: 16 }}>
              <ConstraintWizard
                variable={props.variable || 'value'}
                type={props.type || 'string'}
                onSave={c => { setShowConstraintWizard(false); props.onAddConstraint && props.onAddConstraint(createConstraint(c)); }}
                onCancel={() => setShowConstraintWizard(false)}
              />
            </div>
          ) : (
            <div style={{ padding: 16 }}>
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
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default ResponseEditorUI; 