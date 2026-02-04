// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Status Chip Component
 *
 * Displays a status chip with icon and optional text.
 * Used for STEP 1-7 progress indicators.
 */

import React from 'react';
import { Check, Clock, Edit, X, Loader2 } from 'lucide-react';

export type ChipStatus = 'pending' | 'processing' | 'completed' | 'manual' | 'error' | 'skipped';

interface StatusChipProps {
  status: ChipStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<ChipStatus, { icon: React.ReactNode; color: string; bgColor: string }> = {
  pending: {
    icon: <Clock size={12} />,
    color: '#64748b',
    bgColor: '#1e293b'
  },
  processing: {
    icon: <Loader2 size={12} className="animate-spin" />,
    color: '#fbbf24',
    bgColor: '#78350f'
  },
  completed: {
    icon: <Check size={12} />,
    color: '#22c55e',
    bgColor: '#14532d'
  },
  manual: {
    icon: <Edit size={12} />,
    color: '#3b82f6',
    bgColor: '#1e3a8a'
  },
  error: {
    icon: <X size={12} />,
    color: '#ef4444',
    bgColor: '#7f1d1d'
  },
  skipped: {
    icon: <Clock size={12} />,
    color: '#94a3b8',
    bgColor: '#334155'
  }
};

export default function StatusChip({ status, label, size = 'md', showLabel = false }: StatusChipProps) {
  const config = statusConfig[status];
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md ${sizeClasses[size]}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        border: `1px solid ${config.color}40`
      }}
      title={label || status}
    >
      {config.icon}
      {showLabel && label && <span>{label}</span>}
    </div>
  );
}
