import { Loader2, Check } from 'lucide-react';
import { PipelineStep } from '../hooks/useWizardState';
import { WizardStepMessages, WizardTaskTreeNode } from '../types';

type PipelineProps = {
  steps: PipelineStep[];
  showStructureConfirmation?: boolean;
  onStructureConfirm?: () => void;
  messages: WizardStepMessages | null;
  dataSchema: WizardTaskTreeNode[];
  onHighlightNodes: (nodes: Set<string>) => void;
  onHighlightColor: (color: 'blue' | 'orange') => void;
};

export function Pipeline({
  steps,
  showStructureConfirmation,
  onStructureConfirm,
  messages,
  dataSchema,
  onHighlightNodes,
  onHighlightColor
}: PipelineProps) {
  // Funzione helper per raccogliere tutti gli ID dei nodi
  const getAllNodeIds = (nodes: WizardTaskTreeNode[]): string[] => {
    const ids: string[] = [];
    nodes.forEach(node => {
      ids.push(node.id);
      if (node.subNodes && node.subNodes.length > 0) {
        ids.push(...getAllNodeIds(node.subNodes));
      }
    });
    return ids;
  };

  // Funzione per raccogliere tutti i nodi in una lista piatta
  const flattenTaskTree = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
    const result: WizardTaskTreeNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.subNodes && node.subNodes.length > 0) {
        result.push(...flattenTaskTree(node.subNodes));
      }
    });
    return result;
  };

  // Calcola la percentuale media per una fase specifica
  const getPhaseProgress = (phase: 'constraints' | 'parser' | 'messages'): number => {
    const allTasks = flattenTaskTree(dataSchema);
    if (allTasks.length === 0) return 0;

    const progressField = phase === 'constraints' ? 'constraintsProgress' : phase === 'parser' ? 'parserProgress' : 'messagesProgress';
    const stateField = phase === 'constraints' ? 'constraints' : phase === 'parser' ? 'parser' : 'messages';

    const progresses = allTasks.map(task => {
      const state = task.pipelineStatus?.[stateField] || 'pending';
      if (state === 'pending') return 0;
      if (state === 'completed') return 100;
      return task.pipelineStatus?.[progressField] || 0;
    });

    const total = progresses.reduce((sum, p) => sum + p, 0);
    return Math.round(total / allTasks.length);
  };

  const handleVaBeneHover = (isHovering: boolean) => {
    if (isHovering) {
      const allIds = getAllNodeIds(dataSchema);
      onHighlightNodes(new Set(allIds));
      onHighlightColor('blue');
    } else {
      onHighlightNodes(new Set());
    }
  };

  const handleCorreggiHover = (isHovering: boolean) => {
    if (isHovering) {
      const allIds = getAllNodeIds(dataSchema);
      onHighlightNodes(new Set(allIds));
      onHighlightColor('orange');
    } else {
      onHighlightNodes(new Set());
    }
  };

  const getStatusIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      case 'completed':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'error':
        return <span className="text-red-600">✕</span>;
      case 'pending':
        return <span className="text-gray-400 opacity-40 text-sm">○</span>;
      default:
        return null;
    }
  };

  const getStepLabel = (step: PipelineStep) => {
    let progress = 0;

    // Calcola il progress per le fasi con percentuali
    if (step.id === 'constraints') {
      progress = getPhaseProgress('constraints');
    } else if (step.id === 'parsers') {
      progress = getPhaseProgress('parser');
    } else if (step.id === 'messages') {
      progress = getPhaseProgress('messages');
    }

    switch (step.id) {
      case 'structure':
        if (step.status === 'pending') return 'Struttura dati';
        if (step.status === 'running') return 'Sto studiando che tipo di task serve…';
        if (step.status === 'completed') return 'Struttura dati generata';
        break;
      case 'constraints':
        if (step.status === 'pending') return '○ Vincoli di validazione da generare';
        if (step.status === 'running' && progress < 100) return `Sto generando i vincoli di validazione ${progress}%`;
        if (step.status === 'completed') return 'Vincoli di validazione generati';
        break;
      case 'parsers':
        if (step.status === 'pending') return '○ Parser da generare';
        if (step.status === 'running' && progress < 100) return `Sto generando i parser ${progress}%`;
        if (step.status === 'completed') return 'Parser generati';
        break;
      case 'messages':
        if (step.status === 'pending') return '○ Messaggi da generare';
        if (step.status === 'running' && progress < 100) return `Sto generando i messaggi ${progress}%`;
        if (step.status === 'completed') return 'Messaggi generati';
        break;
    }
    return step.label;
  };

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.id} className="relative">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getStatusIcon(step.status)}
            </div>
            <div className="flex-1">
              <h3 className={`${
                step.status === 'running' || step.status === 'completed'
                  ? 'font-bold'
                  : ''
              } ${
                step.status === 'running'
                  ? 'text-blue-600'
                  : step.status === 'completed'
                    ? 'text-green-600'
                    : step.status === 'pending'
                      ? 'text-gray-400 opacity-50'
                      : 'text-gray-400'
              }`}>
                {getStepLabel(step)}
              </h3>

              {/* Mostra il payload solo quando lo step è in running */}
              {step.status === 'running' && step.payload && (
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {step.payload}
                </p>
              )}

              {/* Mostra il messaggio di conferma struttura */}
              {step.id === 'structure' && step.status === 'completed' && showStructureConfirmation && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-gray-700">
                    A sinistra puoi vedere la struttura dati che ho pensato.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onStructureConfirm}
                      onMouseEnter={() => handleVaBeneHover(true)}
                      onMouseLeave={() => handleVaBeneHover(false)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Va bene
                    </button>
                    <button
                      onMouseEnter={() => handleCorreggiHover(true)}
                      onMouseLeave={() => handleCorreggiHover(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm font-medium cursor-not-allowed"
                      disabled
                    >
                      Correggi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-200" />
          )}
        </div>
      ))}
    </div>
  );
}
