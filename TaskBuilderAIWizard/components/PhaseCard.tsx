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
};

export function PhaseCard({
  icon: Icon,
  title,
  payoff,
  state,
  progress,
  description,
  isExpanded = false,
  showCorrectionForm = false,
  correctionInput = '',
  onCorrectionInputChange
}: PhaseCardProps) {
  const isCompleted = state === 'completed';
  const isRunning = state === 'running';
  const isEditing = showCorrectionForm && isExpanded;

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-md transition-all
        ${isRunning ? 'ring-2 ring-blue-500' : ''}
        ${isEditing ? 'border-2 border-orange-500' : 'border border-gray-200'}
      `}
    >
      {/* Riga superiore: Icona + Titolo + Payoff (sinistra) | Stato + % (destra) */}
      <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: '48px' }}>
        {/* Left: Icona + Titolo + Payoff */}
        <div className="flex items-center gap-3">
          <div className={`
            ${isEditing ? 'text-orange-500' : isCompleted ? 'text-green-500' : isRunning ? 'text-blue-500' : 'text-gray-400'}
          `}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {title}
          </div>
          {payoff && (
            <div className="text-xs text-gray-500 ml-1">
              {payoff}
            </div>
          )}
        </div>

        {/* Right: Stato + percentuale */}
        <div className="flex items-center gap-2">
          {isRunning && !isEditing && (
            <>
              <span className="text-xs font-medium text-blue-600">In generazione</span>
              {typeof progress === 'number' && (
                <span className="text-xs font-medium text-blue-600">{progress}%</span>
              )}
            </>
          )}

          {isCompleted && !isEditing && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
              <span className="text-base">✔</span>
              <span>Completato</span>
            </div>
          )}
        </div>
      </div>

      {/* Barra di avanzamento sotto */}
      {isRunning && typeof progress === 'number' && !isEditing && (
        <div className="px-4 pb-3">
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Form di correzione (se necessario) */}
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
            className="w-full px-4 py-3 border border-orange-300 rounded-xl text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
