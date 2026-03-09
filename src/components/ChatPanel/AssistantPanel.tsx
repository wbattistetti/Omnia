// Assistant Panel Component
// Wrapper for DDEBubbleChat to be used as a dockable panel

import React from 'react';
import DDEBubbleChat from '@responseEditor/ChatSimulator/DDEBubbleChat';
import { FontProvider } from '@context/FontContext';
import type { Task } from '@types/taskTypes';
import type { TaskTree } from '@types/taskTypes';
import type { Message } from '@components/ChatSimulator/UserMessage';
import type { Node } from 'reactflow';
import type { FlowNode, EdgeData } from '@components/Flowchart/types/flowTypes';

export interface AssistantPanelProps {
  task?: Task | null;
  projectId?: string | null;
  translations?: Record<string, string>;
  taskTree?: TaskTree | null;
  onUpdateTaskTree?: (updater: (taskTree: any) => any) => void;
  mode?: 'interactive' | 'preview';
  previewMessages?: Message[];
  activeScenario?: 'happy' | 'partial' | 'error';
  onScenarioChange?: (scenario: 'happy' | 'partial' | 'error') => void;
  flowNodes?: Node<FlowNode>[];
  flowEdges?: any[]; // Edge<EdgeData>[] - using any[] to avoid circular dependency
  flowTasks?: any[];
  useBackendMaterialization?: boolean;
}

export function AssistantPanel(props: AssistantPanelProps) {
  return (
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <FontProvider>
        <DDEBubbleChat
          key={`${props.task?.id || 'flow'}-${props.flowNodes?.length || 0}-${props.flowEdges?.length || 0}`}
          task={props.task || null}
          projectId={props.projectId || null}
          translations={props.translations}
          taskTree={props.taskTree}
          onUpdateTaskTree={props.onUpdateTaskTree || (() => {})}
          mode={props.mode || 'interactive'}
          previewMessages={props.previewMessages}
          activeScenario={props.activeScenario}
          onScenarioChange={props.onScenarioChange}
          flowNodes={props.flowNodes}
          flowEdges={props.flowEdges}
          flowTasks={props.flowTasks}
          useBackendMaterialization={props.useBackendMaterialization || false}
        />
      </FontProvider>
    </div>
  );
}
