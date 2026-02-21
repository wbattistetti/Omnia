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
  dynamicMessage?: string;
};

export function PhaseCard({
  icon: Icon,
  title,
  state,
  progress,
  isExpanded = false,
  showCorrectionForm = false,
  correctionInput = '',
  onCorrectionInputChange,
  dynamicMessage,
}: PhaseCardProps) {
  const isCompleted = state === 'completed';
  const isRunning   = state === 'running';
  const isEditing   = showCorrectionForm && isExpanded;

  const showProgressBar =
    (isRunning || isCompleted) && progress !== undefined;

  const pct = Math.min(100, Math.max(0, progress ?? 0));
  const barColor = isCompleted ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-md transition-all w-full
        ${isRunning  ? 'ring-2 ring-blue-500' : ''}
        ${isEditing  ? 'border-2 border-orange-500' : 'border border-gray-200'}
      `}
    >
      {/* Header row: icon + title + status IMMEDIATELY to the right of title */}
      <div
        className="flex items-center gap-3 px-4 py-3"
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

        {/* Status — sits immediately after the title colon */}
        {isRunning && !isEditing && dynamicMessage && (
          <div className="flex items-center gap-2 min-w-0">
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

        {isCompleted && !isEditing && dynamicMessage && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <span className="text-base leading-none">✔</span>
            <span>{dynamicMessage}</span>
          </div>
        )}

        {!isRunning && !isCompleted && !isEditing && (
          <span className="text-sm text-gray-400">In attesa...</span>
        )}
      </div>

      {/* Progress bar — percentage first, then bar fills full card width */}
      {showProgressBar && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-blue-600 w-9 text-right flex-shrink-0">
              {pct}%
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

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
            className="w-full px-4 py-3 border border-orange-300 rounded-xl text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
