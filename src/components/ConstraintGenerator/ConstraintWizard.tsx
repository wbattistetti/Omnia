import React, { useState, useEffect } from 'react';
import { Constraint, AIScriptResult, LanguageKey } from './types';
import ConstraintMonacoEditor from './ConstraintMonacoEditor';
import ConstraintTestTable from './ConstraintTestTable';
import { generateConstraint } from './ConstraintAPI';
import { AlertTriangle, Pencil, Lock, Clock, Hourglass } from 'lucide-react';
import { setMonacoMarkers } from '../../utils/monacoMarkers';
import * as monaco from 'monaco-editor';
import MonacoEditorWithToolbar from './MonacoEditorWithToolbar';
import { PLACEHOLDER_DESCRIPTION, PLACEHOLDER_AI_LABEL, PLACEHOLDER_AI_PAYOFF, PLACEHOLDER_AI_SUMMARY, PLACEHOLDER_AI_LOADING, PLACEHOLDER_AI_CREATING, COLOR_MONACO_BORDER, COLOR_MONACO_BG } from './constants';
import LoadingSpinner from './LoadingSpinner';
import { useConstraintAI } from './useConstraintAI';
import ErrorMessage from './ErrorMessage';
import { useConstraintWizard } from './useConstraintWizard';

interface ConstraintWizardProps {
  variable: string;
  type: string;
  onSave: (constraint: Constraint) => void;
  onCancel?: () => void;
}

const ConstraintWizard: React.FC<ConstraintWizardProps> = ({ variable, type, onSave, onCancel }) => {
  const wizard = useConstraintWizard(variable, type);
  const {
    step, setStep,
    description, setDescription,
    label, setLabel,
    constraint, setConstraint,
    loading, setLoading,
    error, setError,
    editing, setEditing,
    currentLanguage, setCurrentLanguage,
    showComments, setShowComments,
    aiScripts, setAIScripts,
    aiSummary, setAISummary,
    aiTests, setAITests,
    aiLabel, setAILabel,
    aiPayoff, setAIPayoff,
    aiLoading, aiError, aiResult,
    editingLabel, setEditingLabel,
    editingPayoff, setEditingPayoff,
    handleAIClick,
    handleLabelSubmit,
    handleGenerateConstraint,
    handleScriptChange,
    handleTestCasesChange,
    getConstraintIcon,
    handleLanguageChange
  } = wizard;

  // Aggiungi questo effetto per il cursore spinner globale:
  useEffect(() => {
    if (loading || aiLoading) {
      document.body.style.cursor = 'progress';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.cursor = '';
    };
  }, [loading, aiLoading]);

  // Stato per la riga di inserimento test (per ConstraintTestTable)
  const [newTestRow, setNewTestRow] = useState({ input: '', expected: true, description: '' });
  // Handler per aggiornare i campi della riga di inserimento
  function handleNewTestRowChange(field: 'input' | 'expected' | 'description', value: any) {
    setNewTestRow(row => ({ ...row, [field]: value }));
  }
  // Handler per aggiungere la nuova riga ai test
  function handleAddTestRow() {
    if (!newTestRow.input?.toString().trim()) return;
    const updated = [...(aiTests.length > 0 ? aiTests : (constraint?.testCases || [])), { ...newTestRow }];
    if (aiTests.length > 0) setAITests(updated);
    else if (constraint) setConstraint({ ...constraint, testCases: updated });
    setNewTestRow({ input: '', expected: true, description: '' });
  }

  // Stato per l'altezza del pannello Monaco
  const [panelHeight, setPanelHeight] = useState(320);

  return (
    <div style={{ width: '100%', height: '100%', background: '#fafaff', borderRadius: 0, padding: 0, boxShadow: 'none' }}>
      {/* Step 1: descrizione + etichetta + invio */}
      {step === 1 && (
        <>
          <div style={{ marginBottom: 12, color: '#fff' }}>Che vincolo vuoi applicare?</div>
          {/* Etichetta generata + matita, oppure textarea */}
          {!editing && aiLabel && (
            <div style={{ display: 'flex', flexDirection: 'column', background: '#23232b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Icona vincolo */}
                {(() => {
                  const icon = getConstraintIcon();
                  if (icon === 'clock') return <Clock size={18} style={{ color: '#fbbf24', marginRight: 6 }} />;
                  return <Lock size={18} style={{ color: '#a21caf', marginRight: 6 }} />;
                })()}
                {editingLabel ? (
                  <input
                    value={aiLabel}
                    onChange={e => setAILabel(e.target.value)}
                    onBlur={() => setEditingLabel(false)}
                    style={{ fontWeight: 600, color: '#fff', fontSize: 15, background: 'transparent', border: '1px solid #a21caf', borderRadius: 4, padding: '2px 6px', minWidth: 60 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: 15 }} title={aiPayoff}>{aiLabel}</span>
                )}
                <Pencil size={16} style={{ color: '#888', cursor: 'pointer' }} onClick={() => setEditingLabel(true)} />
                {/* Pulsante IA per rigenerare label/payoff */}
                <button onClick={handleAIClick} style={{ background: '#a21caf', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} title="Rigenera label e descrizione con IA">
                  IA
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                {editingPayoff ? (
                  <input
                    value={aiPayoff}
                    onChange={e => setAIPayoff(e.target.value)}
                    onBlur={() => setEditingPayoff(false)}
                    style={{ color: '#fbbf24', fontSize: 13, background: 'transparent', border: '1px solid #a21caf', borderRadius: 4, padding: '2px 6px', minWidth: 120 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ color: '#fbbf24', fontSize: 13 }}>{aiPayoff}</span>
                )}
                <Pencil size={14} style={{ color: '#888', cursor: 'pointer' }} onClick={() => setEditingPayoff(true)} />
              </div>
            </div>
          )}
          {editing && (
            <>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={PLACEHOLDER_DESCRIPTION}
                style={{ width: '100%', minHeight: 60, borderRadius: 8, border: '1px solid #888', padding: 10, fontSize: 15, marginBottom: 12 }}
              />
              {(loading || aiLoading) && (
                <LoadingSpinner color="#2563eb" message={PLACEHOLDER_AI_LOADING} style={{ margin: '8px 0 0 0' }} />
              )}
            </>
          )}
          {error && <ErrorMessage message={error} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  background: 'none',
                  color: '#fff',
                  border: 'none',
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Annulla
              </button>
            )}
            {/* Pulsante invia/genera constraint */}
            {!editing && label ? (
              <button
                onClick={handleGenerateConstraint}
                disabled={loading}
                style={{
                  background: '#a21caf',
                  color: '#fff',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 28px',
                  fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Generazione in corso...' : 'Genera constraint'}
              </button>
            ) : (
              <button
                onClick={handleLabelSubmit}
                disabled={loading || !description.trim()}
                style={{
                  background: '#a21caf',
                  color: '#fff',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 28px',
                  fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Generazione in corso...' : 'Invia'}
              </button>
            )}
          </div>
        </>
      )}
      {/* Step 2: mostra constraint generato e test */}
      {step === 2 && (
        <>
          {/* Label + payoff + matita + IA */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#23232b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Icona vincolo */}
              {(() => {
                const icon = getConstraintIcon();
                if (icon === 'clock') return <Clock size={18} style={{ color: '#fbbf24', marginRight: 6 }} />;
                return <Lock size={18} style={{ color: '#a21caf', marginRight: 6 }} />;
              })()}
              {editingLabel ? (
                <input
                  value={aiLabel}
                  onChange={e => setAILabel(e.target.value)}
                  onBlur={() => setEditingLabel(false)}
                  style={{ fontWeight: 600, color: '#fff', fontSize: 15, background: 'transparent', border: '1px solid #a21caf', borderRadius: 4, padding: '2px 6px', minWidth: 60 }}
                  autoFocus
                />
              ) : (
                <span style={{ fontWeight: 600, color: '#fff', fontSize: 15 }} title={aiPayoff}>{aiLabel}</span>
              )}
              <Pencil size={16} style={{ color: '#888', cursor: 'pointer' }} onClick={() => setEditingLabel(true)} />
              {/* Pulsante IA per rigenerare label/payoff */}
              <button onClick={handleAIClick} style={{ background: '#a21caf', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} title="Rigenera label e descrizione con IA">
                IA
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {editingPayoff ? (
                <input
                  value={aiPayoff}
                  onChange={e => setAIPayoff(e.target.value)}
                  onBlur={() => setEditingPayoff(false)}
                  style={{ color: '#fbbf24', fontSize: 13, background: 'transparent', border: '1px solid #a21caf', borderRadius: 4, padding: '2px 6px', minWidth: 120 }}
                  autoFocus
                />
              ) : (
                <span style={{ color: '#fbbf24', fontSize: 13 }}>{aiPayoff}</span>
              )}
              <Pencil size={14} style={{ color: '#888', cursor: 'pointer' }} onClick={() => setEditingPayoff(true)} />
            </div>
          </div>
          {(loading || aiLoading) && (
            <LoadingSpinner color="#2563eb" message={PLACEHOLDER_AI_CREATING} style={{ margin: '8px 0 0 0' }} />
          )}
          <MonacoEditorWithToolbar
            scriptsByLanguage={aiScripts}
            summary={aiSummary}
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            showComments={showComments}
            onToggleComments={() => setShowComments(s => !s)}
            onAIClick={handleAIClick}
            panelHeight={panelHeight}
            onPanelHeightChange={setPanelHeight}
          />
          <ConstraintTestTable
            script={constraint?.script || ''}
            variable={constraint?.variable || ''}
            type={constraint?.type || ''}
            testCases={aiTests.length > 0 ? aiTests : (constraint?.testCases || [])}
            onChange={handleTestCasesChange}
            newRow={newTestRow}
            onNewRowChange={handleNewTestRowChange}
            onAddRow={handleAddTestRow}
          />
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            {onCancel && (
              <button onClick={onCancel} style={{ background: 'none', color: '#a21caf', border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: 700, padding: '7px 18px', borderRadius: 6 }}>
                Annulla
              </button>
            )}
            <button onClick={() => onSave(constraint || {
              id: '',
              title: '',
              script: '',
              explanation: '',
              messages: [],
              testCases: [],
              variable: '',
              type: ''
            })} style={{ background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 13, marginLeft: 0 }}>
              Salva constraint
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConstraintWizard; 