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
  // ✅ NEW: Messaggio dinamico con parte variabile in grassetto
  dynamicMessage?: string; // Es: "sto generando i parser NLP per l'estrazione dei dati da una frase: **regex**..."
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
  onCorrectionInputChange,
  dynamicMessage
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
      {/* ✅ SINGOLA RIGA: Etichetta a sinistra | Payload/Spinner/Spunta a destra */}
      <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: '48px' }}>
        {/* Left: Icona + Titolo */}
        <div className="flex items-center gap-3">
          <div className={`
            ${isEditing ? 'text-orange-500' : isCompleted ? 'text-green-500' : isRunning ? 'text-blue-500' : 'text-gray-400'}
          `}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-gray-900">
            {title}:
          </div>
        </div>

        {/* Right: Payload dinamico (spinner + testo) oppure spunta finale */}
        <div className="flex items-center gap-2 flex-1 justify-end ml-4">
          {isRunning && !isEditing && dynamicMessage && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-gray-700">
                {dynamicMessage.split('**').map((part, index) =>
                  index % 2 === 1 ? (
                    <strong key={index} className="font-bold text-gray-900">{part}</strong>
                  ) : (
                    <span key={index}>{part}</span>
                  )
                )}
              </span>
            </div>
          )}

          {isCompleted && !isEditing && dynamicMessage && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="text-base">✔</span>
              <span>{dynamicMessage}</span>
            </div>
          )}

          {!isRunning && !isCompleted && !isEditing && (
            <span className="text-sm text-gray-400">In attesa...</span>
          )}
        </div>
      </div>

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
