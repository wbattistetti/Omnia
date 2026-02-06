// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Loader2, Check, FileText, FileCheck, MessageSquare } from 'lucide-react';
import { useFontContext } from '../../../../context/FontContext';

export type ChipType = 'constraints' | 'contracts' | 'messaggi';

interface PipelineProgressChipProps {
  type: ChipType;
  status: 'in-progress' | 'completed';
  currentStepName?: string; // Solo per messaggi: "start", "normal", "non ho capito", ecc.
}

const PipelineProgressChip: React.FC<PipelineProgressChipProps> = ({
  type,
  status,
  currentStepName,
}) => {
  const { combinedClass } = useFontContext();

  const getIcon = () => {
    if (status === 'in-progress') {
      return <Loader2 size={14} className="animate-spin" style={{ color: '#94a3b8' }} />;
    }
    // Completed: icona specifica per tipo
    switch (type) {
      case 'constraints':
        return <FileText size={14} color="#22c55e" />;
      case 'contracts':
        return <FileCheck size={14} color="#22c55e" />;
      case 'messaggi':
        return <MessageSquare size={14} color="#22c55e" />;
      default:
        return <Check size={14} color="#22c55e" />;
    }
  };

  const getText = () => {
    if (status === 'in-progress') {
      if (type === 'messaggi' && currentStepName) {
        // Mappa i nomi step a testi user-friendly
        const stepMap: Record<string, string> = {
          'start': 'start...',
          'normal': 'normal...',
          'noMatch': 'non ho capito...',
          'noInput': 'non ho sentito...',
          'confirmation': 'conferma...',
          'success': 'successo...',
        };
        return stepMap[currentStepName] || `${currentStepName}...`;
      }
      return `${type}...`;
    }
    return type;
  };

  const getTextColor = () => {
    return status === 'completed' ? '#22c55e' : '#94a3b8';
  };

  return (
    <div
      className={combinedClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 12,
        border: '1px solid #334155',
        background: '#1f2937',
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {getIcon()}
      <span style={{ color: getTextColor() }}>{getText()}</span>
    </div>
  );
};

export default PipelineProgressChip;
