import React from 'react';
import { Bot, Database, CheckSquare } from 'lucide-react';

export interface EntityTypeConfig {
  type: 'agentAct' | 'backendCall' | 'task' | 'condition';
  icon: React.ReactNode;
  label: string;
  color: string;
}

export const ENTITY_TYPE_CONFIGS: Record<string, EntityTypeConfig> = {
  agentAct: {
    type: 'agentAct',
    icon: <Bot className="w-3 h-3" />,
    label: 'Agent Act',
    color: 'text-green-500'
  },
  backendCall: {
    type: 'backendCall',
    icon: <Database className="w-3 h-3" />,
    label: 'Backend Call',
    color: 'text-blue-500'
  },
  task: {
    type: 'task',
    icon: <CheckSquare className="w-3 h-3" />,
    label: 'Task',
    color: 'text-orange-500'
  },
  condition: {
    type: 'condition',
    icon: <CheckSquare className="w-3 h-3" />,
    label: 'Condition',
    color: 'text-green-500'
  }
};

// Configurazioni per diversi contesti
export const CONTEXT_CONFIGS = {
  nodes: ['agentAct', 'backendCall', 'task'] as const,
  conditions: ['condition'] as const,
  sidebar: ['agentAct', 'backendCall', 'task', 'condition'] as const
};

export type ContextType = keyof typeof CONTEXT_CONFIGS;

