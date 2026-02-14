// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TaskTree, Task } from '@types/taskTypes';
import { AdaptTaskTreePromptToContext } from '@utils/taskTreePromptAdapter';

export interface TaskContextualizationPanelProps {
  taskTree: TaskTree | null;
  taskLabel: string;
  templateId: string;
  task: Task | null; // ✅ NEW: Task completo necessario per AdaptTaskTreePromptToContext
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
  task,
  onComplete,
  onCancel,
  onAbort,
}: TaskContextualizationPanelProps) {
  const [status, setStatus] = useState<'processing' | 'completed' | 'error'>('processing');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (!taskTree || !task) return;

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    // ✅ REAL: Chiama AdaptTaskTreePromptToContext per adattare i prompt
    const contextualizeMessages = async () => {
      try {
        setCurrentStep('Caricamento template e traduzioni...');
        setProgress(10);

        // ✅ STEP 1: Ricarica il task dal repository per assicurarsi che abbia gli steps clonati
        // buildTaskTree clona gli steps e li salva nel repository, ma il task passato come prop
        // potrebbe non essere aggiornato
        const { taskRepository } = await import('@services/TaskRepository');
        const updatedTask = taskRepository.getTask(task.id);

        if (!updatedTask) {
          console.error('[TaskContextualizationPanel] ❌ Task non trovato nel repository', { taskId: task.id });
          setStatus('error');
          setCurrentStep('Errore: Task non trovato');
          return;
        }

        // ✅ STEP 2: Verifica che il task abbia steps (devono essere stati clonati da buildTaskTree)
        if (!updatedTask.steps || Object.keys(updatedTask.steps).length === 0) {
          console.warn('[TaskContextualizationPanel] ⚠️ Task senza steps, niente da adattare', {
            taskId: updatedTask.id,
            hasSteps: !!updatedTask.steps,
            stepsKeys: updatedTask.steps ? Object.keys(updatedTask.steps) : []
          });
          setStatus('completed');
          setProgress(100);
          setCurrentStep('Nessun prompt da adattare');
          setTimeout(() => {
            onComplete(taskTree);
          }, 500);
          return;
        }

        console.log('[TaskContextualizationPanel] ✅ Task caricato con steps', {
          taskId: updatedTask.id,
          stepsCount: Object.keys(updatedTask.steps).length,
          stepsKeys: Object.keys(updatedTask.steps)
        });

        setCurrentStep('Personalizzazione messaggi root...');
        setProgress(30);

        // ✅ STEP 3: Chiama AdaptTaskTreePromptToContext con il task aggiornato
        // Questa funzione modifica updatedTask.steps in-place e salva le traduzioni adattate
        await AdaptTaskTreePromptToContext(updatedTask, taskLabel, false); // false = solo nodi radice

        setProgress(70);
        setCurrentStep('Adattamento messaggi per il contesto...');

        // ✅ STEP 4: Ricarica il task dal repository dopo l'adattamento
        // AdaptTaskTreePromptToContext modifica in-place, ma dobbiamo assicurarci che sia salvato
        const finalTask = taskRepository.getTask(updatedTask.id);

        if (!finalTask || !finalTask.steps) {
          console.error('[TaskContextualizationPanel] ❌ Task senza steps dopo adattamento', { taskId: updatedTask.id });
          setStatus('error');
          setCurrentStep('Errore: Steps non trovati dopo adattamento');
          return;
        }

        // ✅ STEP 5: Costruisci TaskTree aggiornato con gli steps modificati
        const contextualizedTaskTree: TaskTree = {
          ...taskTree,
          steps: finalTask.steps, // ✅ Steps modificati in-place da AdaptTaskTreePromptToContext
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
        console.error('[TaskContextualizationPanel] ❌ Errore durante contestualizzazione:', error);
        setStatus('error');
        setCurrentStep(`Errore: ${error.message || 'Errore durante la contestualizzazione'}`);
      }
    };

    contextualizeMessages();

    // Cleanup on unmount
    return () => {
      if (controller) {
        controller.abort();
      }
    };
  }, [taskTree, taskLabel, templateId, task, onComplete, onAbort]);

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
