import React from 'react';
import { PlayCircle, MicOff, HelpCircle, CheckCircle2, CheckSquare, AlertCircle, AlertTriangle, Wine } from 'lucide-react';
import { stepMeta } from '@responseEditor/ddtUtils';

// Helper function to get icon for step type with color
export function getStepIcon(stepType?: string, color?: string) {
  const iconSize = 16;
  const iconStyle = color ? { color } : undefined;

  switch (stepType) {
    case 'ask':
    case 'start':
      return <PlayCircle size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'noInput':
      return <MicOff size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'noMatch':
      return <HelpCircle size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'confirm':
    case 'confirmation':
      return <CheckCircle2 size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'success':
      return <CheckSquare size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'notConfirmed':
      return <AlertCircle size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'introduction':
      return <Wine size={iconSize} className="flex-shrink-0" style={iconStyle} />;
    case 'error':
      return (
        <AlertTriangle size={iconSize} className="flex-shrink-0 text-amber-500" style={iconStyle} />
      );
    case 'warning':
      return <AlertCircle size={iconSize} className="flex-shrink-0 text-amber-400" style={iconStyle} />;
    default:
      return null;
  }
}

// Helper function to get color for step type from stepMeta
export function getStepColor(stepType?: string): string | undefined {
  if (!stepType) return undefined;
  const stepTypeMap: Record<string, string> = {
    start: 'start',
    ask: 'start',
    noMatch: 'noMatch',
    noInput: 'noInput',
    confirmation: 'confirmation',
    confirm: 'confirmation',
    success: 'success',
    introduction: 'introduction',
    error: 'error',
    warning: 'warning',
  };
  const metaKey = stepTypeMap[stepType] || stepType;
  const meta = stepMeta[metaKey];
  return meta?.border;
}

