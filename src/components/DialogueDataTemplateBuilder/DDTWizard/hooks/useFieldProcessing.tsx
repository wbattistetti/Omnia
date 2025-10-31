import React from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';

export interface FieldProcessingState {
  fieldId: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
}

interface UseFieldProcessingProps {
  fieldProcessingStates?: Record<string, FieldProcessingState>;
  progressByPath?: Record<string, number>;
}

export function useFieldProcessing({ fieldProcessingStates, progressByPath }: UseFieldProcessingProps) {
  const getFieldProcessingState = (fieldId: string): FieldProcessingState | null => {
    return fieldProcessingStates?.[fieldId] || null;
  };

  const getStatusIcon = (fieldId: string): React.ReactNode => {
    const state = getFieldProcessingState(fieldId);
    const progress = progressByPath?.[fieldId] || 0;

    // Priority: If we have progressByPath, use that (more reliable)
    if (progress >= 100) return <Check className="w-4 h-4 text-green-600" />;
    if (progress > 0) return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;

    // Fallback to fieldProcessingStates only if no progressByPath
    const status = state?.status || 'idle';
    switch (status) {
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
      case 'completed': return <Check className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusMessage = (fieldId: string): string => {
    const state = getFieldProcessingState(fieldId);
    const progress = progressByPath?.[fieldId] || 0;

    // Priority: If we have progressByPath, use that (more reliable)
    if (progress >= 100) return "Done!";
    if (progress > 0) return "Generando messaggi normal...";

    // Fallback to fieldProcessingStates only if no progressByPath
    if (state?.message) return state.message;

    return "In attesa...";
  };

  const getProgress = (fieldId: string): number => {
    return progressByPath?.[fieldId] || 0;
  };

  return {
    getFieldProcessingState,
    getStatusIcon,
    getStatusMessage,
    getProgress
  };
}

