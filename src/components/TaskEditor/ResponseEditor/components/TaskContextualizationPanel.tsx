// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TaskTree } from '@types/taskTypes';

export interface TaskContextualizationPanelProps {
  taskTree: TaskTree | null;
  taskLabel: string;
  templateId: string;
  onComplete: (contextualizedTaskTree: TaskTree) => void;
  onCancel?: () => void;
  onAbort?: () => void;
}

/**
 * Panel that shows the progress of message contextualization
 * when heuristic found a candidate template
 */
export function TaskContextualizationPanel({
  taskTree,
  taskLabel,
  templateId,
  onComplete,
  onCancel,
  onAbort,
}: TaskContextualizationPanelProps) {
  const [status, setStatus] = useState<'processing' | 'completed' | 'error'>('processing');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (!taskTree) return;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    // Simulate contextualization process
    const contextualizeMessages = async () => {
      try {
        setCurrentStep('Personalizzazione messaggi root...');
        setProgress(20);

        // ✅ MOCK: Simulate API call with delay
        // TODO: Replace with real API call: POST /api/tasks/contextualize-messages
        // The API should take template and node label
        // and transform generic prompts into contextualized prompts
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        setProgress(40);

        setCurrentStep('Adattamento messaggi per il contesto...');
        await new Promise(resolve => setTimeout(resolve, 500));
        setProgress(60);

        setCurrentStep('Personalizzazione step di dialogo...');
        await new Promise(resolve => setTimeout(resolve, 500));
        setProgress(80);

        // ✅ MOCK: Create contextualized TaskTree
        // In real implementation, this would come from the API
        // For now, we just return the same taskTree (it will be contextualized by backend later)
        const contextualizedTaskTree: TaskTree = {
          ...taskTree,
          // In real implementation, steps would be contextualized here
          // For now, we keep the same structure
        };

        setProgress(100);
        setStatus('completed');
        setCurrentStep('Contestualizzazione completata!');

        // Call onComplete after a brief delay to show success
        setTimeout(() => {
          onComplete(contextualizedTaskTree);
        }, 500);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // User cancelled, notify parent
          if (onAbort) {
            onAbort();
          }
          return;
        }
        console.error('[TaskContextualizationPanel] Error:', error);
        setStatus('error');
        setCurrentStep('Errore durante la contestualizzazione');
      }
    };

    contextualizeMessages();

    // Cleanup on unmount
    return () => {
      if (controller) {
        controller.abort();
      }
    };
  }, [taskTree, taskLabel, templateId, onComplete, onAbort]);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e293b',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #334155',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {status === 'processing' && <Loader2 className="animate-spin" size={24} color="#3b82f6" />}
          {status === 'completed' && <CheckCircle2 size={24} color="#10b981" />}
          {status === 'error' && <AlertCircle size={24} color="#ef4444" />}
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
            {status === 'processing' && 'Contestualizzazione in corso...'}
            {status === 'completed' && 'Contestualizzazione completata'}
            {status === 'error' && 'Errore'}
          </h3>
        </div>

        {/* Progress bar */}
        {status === 'processing' && (
          <div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#334155',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#94a3b8' }}>
              {currentStep}
            </p>
          </div>
        )}

        {/* Description */}
        <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
          {status === 'processing' &&
            `Sto personalizzando i messaggi del template "${templateId}" per il contesto "${taskLabel}".`}
          {status === 'completed' &&
            'I messaggi sono stati contestualizzati con successo. Puoi ora modificare il task nell\'editor.'}
          {status === 'error' &&
            'Si è verificato un errore durante la contestualizzazione. Riprova o usa il wizard completo.'}
        </p>

        {/* Actions */}
        {status === 'error' && onCancel && (
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#334155',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Usa wizard completo
          </button>
        )}
      </div>
    </div>
  );
}
