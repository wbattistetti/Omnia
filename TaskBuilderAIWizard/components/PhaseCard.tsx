import React from 'react';
import { LucideIcon } from 'lucide-react';

type PhaseState = 'pending' | 'running' | 'completed';

type PhaseCardProps = {
  icon: LucideIcon;
  title: string;
  payoff?: string;
  state: PhaseState;
  progress?: number;
  description?: string;
  isExpanded?: boolean;
  showCorrectionForm?: boolean;
  correctionInput?: string;
  onCorrectionInputChange?: (value: string) => void;
  onCorrectionSubmit?: () => void; // ✅ NEW: Handler per inviare correzione
  dynamicMessage?: string;
};

/**
 * PhaseCard - Memoized component with custom comparison
 *
 * Only re-renders when relevant props actually change.
 */
export const PhaseCard = React.memo(function PhaseCard({
  icon: Icon,
  title,
  state,
  progress,
  isExpanded = false,
  showCorrectionForm = false,
  correctionInput = '',
  onCorrectionInputChange,
  onCorrectionSubmit,
  dynamicMessage,
}: PhaseCardProps) {
  const isCompleted = state === 'completed';
  const isRunning   = state === 'running';
  const isEditing   = showCorrectionForm && isExpanded;

  const pct = Math.min(100, Math.max(0, progress ?? 0));
  const hasProgress = progress !== undefined && isRunning;

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-md transition-all w-full relative overflow-hidden
        ${isRunning  ? 'ring-2 ring-blue-500' : ''}
        ${isCompleted ? 'ring-2 ring-green-500' : ''}
        ${isEditing  ? 'border-2 border-orange-500' : 'border border-gray-200'}
      `}
    >
      {/* Progress background - la card diventa la progress bar */}
      {isRunning && hasProgress && (
        <div
          className="absolute inset-0 pointer-events-none z-0 rounded-2xl"
          style={{
            background: 'rgba(59, 130, 246, 0.20)',
            width: `${Math.max(2, pct)}%`, // Minimo 2% per visibilità anche a 0%
            transition: 'width 0.3s ease-out',
            backdropFilter: 'brightness(1.05)',
          }}
        />
      )}

      {/* Completed overlay - fade in quando completa */}
      {isCompleted && (
        <div
          className="absolute inset-0 pointer-events-none z-0 bg-green-50/40 transition-opacity duration-500 rounded-2xl"
          style={{ opacity: 1 }}
        />
      )}

      {/* Header row: icon + title + status - sopra la progress bar */}
      <div
        className="relative z-10 flex items-center gap-3 px-4 py-3"
        style={{ minHeight: '48px' }}
      >
        {/* Icon */}
        <div className={
          isEditing   ? 'text-orange-500' :
          isCompleted ? 'text-green-500'  :
          isRunning   ? 'text-blue-500'   : 'text-gray-400'
        }>
          <Icon className="w-6 h-6 flex-shrink-0" />
        </div>

        {/* Title */}
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
          {title}:
        </span>

        {/* STATO 1: Running senza progresso numerico - mostra payload */}
        {isRunning && !isEditing && progress === undefined && dynamicMessage && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate">
              {dynamicMessage.split('**').map((part, i) =>
                i % 2 === 1
                  ? <strong key={i} className="font-bold text-gray-900">{part}</strong>
                  : <span key={i}>{part}</span>
              )}
            </span>
          </div>
        )}

        {/* STATO 2: Running con progresso - mostra percentuale + messaggio */}
        {isRunning && !isEditing && progress !== undefined && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-mono text-blue-600 font-semibold whitespace-nowrap">
              {pct}%
            </span>
            {dynamicMessage && (
              <span className="text-sm text-gray-700 truncate">
                {dynamicMessage.split('**').map((part, i) =>
                  i % 2 === 1
                    ? <strong key={i} className="font-bold text-gray-900">{part}</strong>
                    : <span key={i}>{part}</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* STATO 3: Completed - mostra etichetta di termine */}
        {isCompleted && !isEditing && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <span className="text-base leading-none">✔</span>
            <span>{dynamicMessage || 'Generati!'}</span>
          </div>
        )}

        {/* Pending state */}
        {!isRunning && !isCompleted && !isEditing && (
          <span className="text-sm text-gray-400">In attesa...</span>
        )}
      </div>

      {/* Barra sottile rimossa - la card stessa è la progress bar */}

      {/* Correction form */}
      {isExpanded && showCorrectionForm && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <p className="text-sm text-orange-800 leading-relaxed mb-3">
            <strong>Per aiutarmi a correggere la struttura dati, spiegami come dovrebbe essere organizzata.</strong><br />
            Fornisci ulteriori indicazioni o specifica cosa modificare.
          </p>
          <textarea
            value={correctionInput}
            onChange={(e) => onCorrectionInputChange?.(e.target.value)}
            placeholder="Inserisci le tue indicazioni per la correzione..."
            className="w-full px-4 py-3 border border-orange-300 rounded-xl text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none mb-3"
            rows={4}
          />
          {/* ✅ NEW: Pulsante Invia */}
          <div className="flex justify-end">
            <button
              onClick={async () => {
                console.log('═══════════════════════════════════════════════════════════════════════════');
                console.log('🖱️ [PhaseCard] "Invia" button CLICKED');
                console.log('[PhaseCard] Button state:', {
                  hasOnCorrectionSubmit: !!onCorrectionSubmit,
                  onCorrectionSubmitType: typeof onCorrectionSubmit,
                  correctionInput: correctionInput,
                  correctionInputTrimmed: correctionInput?.trim(),
                  isDisabled: !correctionInput?.trim()
                });
                console.log('[PhaseCard] onCorrectionSubmit function:', onCorrectionSubmit);
                console.log('═══════════════════════════════════════════════════════════════════════════');
                if (onCorrectionSubmit) {
                  try {
                    console.log('[PhaseCard] ✅ Calling onCorrectionSubmit()...');
                    const result = onCorrectionSubmit();
                    if (result instanceof Promise) {
                      console.log('[PhaseCard] ⏳ onCorrectionSubmit returned a Promise, awaiting...');
                      await result;
                      console.log('[PhaseCard] ✅ Promise resolved');
                    } else {
                      console.log('[PhaseCard] ✅ onCorrectionSubmit completed synchronously');
                    }
                  } catch (error) {
                    console.error('[PhaseCard] ❌❌❌ ERROR calling onCorrectionSubmit:', error);
                    console.error('[PhaseCard] Error details:', {
                      message: error instanceof Error ? error.message : String(error),
                      stack: error instanceof Error ? error.stack : undefined
                    });
                  }
                } else {
                  console.error('[PhaseCard] ❌ onCorrectionSubmit is not defined!');
                }
              }}
              disabled={!correctionInput?.trim()}
              className="px-6 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              Invia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ Custom comparison: only re-render if relevant props actually change
  return (
    prevProps.title === nextProps.title &&
    prevProps.state === nextProps.state &&
    prevProps.progress === nextProps.progress &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.showCorrectionForm === nextProps.showCorrectionForm &&
    prevProps.correctionInput === nextProps.correctionInput &&
    prevProps.onCorrectionSubmit === nextProps.onCorrectionSubmit &&
    prevProps.dynamicMessage === nextProps.dynamicMessage &&
    prevProps.icon === nextProps.icon // Icon component reference should be stable
  );
});
