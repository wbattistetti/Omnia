// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Mode Badge Component
 *
 * Displays the mode badge (AI/Manual/Later) for a node.
 */

import React from 'react';
import { Bot, Edit, Clock } from 'lucide-react';
import type { NodeMode } from '../../types/wizard.types';

interface NodeModeBadgeProps {
  mode?: NodeMode;
}

const modeConfig: Record<NodeMode, { icon: React.ReactNode; label: string; color: string }> = {
  ai: {
    icon: <Bot size={14} className="text-yellow-500" />,
    label: 'AI',
    color: 'text-yellow-500'
  },
  manual: {
    icon: <Edit size={14} className="text-blue-500" />,
    label: 'Manual',
    color: 'text-blue-500'
  },
  postponed: {
    icon: <Clock size={14} className="text-gray-500" />,
    label: 'Later',
    color: 'text-gray-500'
  }
};

export default function NodeModeBadge({ mode }: NodeModeBadgeProps) {
  if (!mode) return null;

  const config = modeConfig[mode];

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 border border-gray-700">
      {config.icon}
      <span className="text-xs text-gray-300">{config.label}</span>
    </div>
  );
}
