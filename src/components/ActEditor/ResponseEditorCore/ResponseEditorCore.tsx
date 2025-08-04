import React, { useEffect } from 'react';
import { useDDTEditor } from './useDDTEditor';
import { EditorProvider } from './EditorContext';
import { TreeView } from './TreeView';
import { getDDTIcon, buildDDTForUI, stepMeta } from './ddtUtils';

interface ResponseEditorCoreProps {
  ddt: any;
  translations: any;
  lang: string;
}

const ResponseEditorCore: React.FC<ResponseEditorCoreProps> = ({ ddt, translations, lang }) => {
  const editor = useDDTEditor({ ddt, translations, lang });

  useEffect(() => {
    if (editor.selectedNode) {
      // Miglioria: usa logger.debug invece di console.log
      if (import.meta.env.DEV) {
        console.log('[Core] Selected node:', editor.selectedNode);
      }
    }
  }, [editor.selectedNode]);

  return (
    <EditorProvider value={editor}>
      <div style={{ padding: 24 }}>
        <h2>🧠 ResponseEditorCore</h2>
        
        {/* ✅ NUOVO: Header con info DDT */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            {getDDTIcon(ddt?.dataType?.type)}
            <span style={{ fontWeight: 'bold' }}>{ddt?.label || ddt?.name || '—'}</span>
          </div>
          <p>Tipo: <b>{ddt?.dataType?.type || '—'}</b></p>
        </div>
        
        {/* ✅ NUOVO: Step selector migliorato */}
        <div style={{ marginBottom: 20 }}>
          <h3>Step corrente: <b>{editor.selectedStep}</b></h3>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {Object.keys(stepMeta).map(step => (
              <button 
                key={step}
                onClick={() => editor.setStep(step)}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: editor.selectedStep === step ? '#3b82f6' : '#e5e7eb',
                  color: editor.selectedStep === step ? 'white' : 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {stepMeta[step as keyof typeof stepMeta].label}
              </button>
            ))}
          </div>
          
          {/* ✅ NUOVO: Toggle showLabel */}
          <button 
            onClick={editor.toggleShowLabel}
            style={{ 
              padding: '8px 16px',
              backgroundColor: editor.showLabel ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {editor.showLabel ? 'Nascondi Label' : 'Mostra Label'}
          </button>

          {/* ✅ NUOVO: Pulsante aggiungi escalation */}
          <button 
            onClick={editor.addEscalation}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Aggiungi Recovery
          </button>
        </div>
        
        <hr style={{ margin: '20px 0' }} />
        
        {/* Nuovo: TreeView con funzionalità cestino */}
        <div style={{ marginTop: 20 }}>
          <h3>Nodi ({editor.filteredNodes.length})</h3>
          <TreeView 
            nodes={editor.filteredNodes}
            onRemoveNode={editor.removeNode}
          />
        </div>
        
        {/* Debug: mostra nodi estratti */}
        {import.meta.env.DEV && (
          <details style={{ marginTop: 20 }}>
            <summary>Debug: Nodi estratti</summary>
            <pre style={{ background: '#f9f9f9', padding: 12, fontSize: '12px' }}>
              {JSON.stringify(editor.extractedNodes, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </EditorProvider>
  );
};

export default ResponseEditorCore; 