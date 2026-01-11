import React, { lazy } from 'react';
import type { EditorKind, EditorProps } from './types';
import DDTEditor from '../ResponseEditor/DDTHostAdapter';
import IntentEditor from '../../../features/intent-editor/HostAdapter';
import TextMessageEditor from './editors/TextMessageEditor';
import BackendCallEditor from './editors/BackendCallEditor';
import AIAgentEditor from './editors/AIAgentEditor';
import SummarizerEditor from './editors/SummarizerEditor';
import NegotiationEditor from './editors/NegotiationEditor';

type LazyComp = React.LazyExoticComponent<React.ComponentType<EditorProps>>;
type DirectComp = React.ComponentType<EditorProps>;

// ✅ Simple editor fallback component
const SimpleEditor: React.FC<EditorProps> = ({ task, onClose }) => {
  return (
    <div className="h-full w-full bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center">
        <p className="text-lg mb-2">Editor not available</p>
        <p className="text-sm text-gray-400">Task type: {task?.type ?? 'Unknown'}</p>
      </div>
    </div>
  );
};

// ✅ BackendCallEditor ora importato direttamente per aprire istantaneamente (come DDTEditor, IntentEditor, TextMessageEditor)

export const registry: Record<EditorKind, LazyComp | DirectComp> = {
  message: TextMessageEditor, // Import diretto per aprire istantaneamente l'editor Message
  ddt: DDTEditor, // Import diretto per evitare lazy loading delay
  intent: IntentEditor, // Import diretto per aprire istantaneamente l'editor ProblemClassification
  backend: BackendCallEditor, // ✅ Import diretto per aprire istantaneamente l'editor BackendCall
  problem: IntentEditor, // ✅ Alias per 'intent' (ClassifyProblem usa IntentEditor)
  aiagent: AIAgentEditor, // ✅ Editor dedicato per AIAgent
  summarizer: SummarizerEditor, // ✅ Editor dedicato per Summarizer
  negotiation: NegotiationEditor, // ✅ Editor dedicato per Negotiation
  simple: SimpleEditor, // ✅ Fallback editor per tipi non supportati
};


