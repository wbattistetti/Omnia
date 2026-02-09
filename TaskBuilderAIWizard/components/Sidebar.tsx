import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Calendar, Hash, Type, MapPin, Clock, User, Phone, FileText, Package, CreditCard, Home, Utensils, Stethoscope } from 'lucide-react';
import { WizardTaskTreeNode } from '../types';

type SidebarProps = {
  taskTree: WizardTaskTreeNode[];
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  registerNode: (id: string, element: HTMLDivElement | null) => void;
  showStructureConfirmation?: boolean;
  onStructureConfirm?: () => void;
  onStructureReject?: () => void;
  structureConfirmed?: boolean;
};

export function Sidebar({
  taskTree,
  activeNodeId,
  onNodeClick,
  registerNode,
  showStructureConfirmation = false,
  onStructureConfirm,
  onStructureReject,
  structureConfirmed = false
}: SidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  useEffect(() => {
    const collectAllNodeIds = (nodes: WizardTaskTreeNode[]): string[] => {
      const ids: string[] = [];
      nodes.forEach(node => {
        ids.push(node.id);
        if (node.subNodes && node.subNodes.length > 0) {
          ids.push(...collectAllNodeIds(node.subNodes));
        }
      });
      return ids;
    };

    if (taskTree.length > 0) {
      const allIds = collectAllNodeIds(taskTree);
      setExpandedNodes(new Set(['root', ...allIds]));
    }
  }, [taskTree]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const getNodeIcon = (node: WizardTaskTreeNode) => {
    const label = node.label.toLowerCase();
    const iconClass = "w-4 h-4";

    if (label.includes('data') || label.includes('date')) return <Calendar className={iconClass} />;
    if (label.includes('giorno') || label.includes('day')) return <Calendar className={iconClass} />;
    if (label.includes('mese') || label.includes('month')) return <Calendar className={iconClass} />;
    if (label.includes('anno') || label.includes('year')) return <Hash className={iconClass} />;
    if (label.includes('orario') || label.includes('time')) return <Clock className={iconClass} />;
    if (label.includes('numero') || node.type === 'number') return <Hash className={iconClass} />;
    if (label.includes('nome') || label.includes('name')) return <User className={iconClass} />;
    if (label.includes('cognome') || label.includes('surname')) return <User className={iconClass} />;
    if (label.includes('telefono') || label.includes('phone')) return <Phone className={iconClass} />;
    if (label.includes('indirizzo') || label.includes('address')) return <MapPin className={iconClass} />;
    if (label.includes('via') || label.includes('street')) return <Home className={iconClass} />;
    if (label.includes('città') || label.includes('city')) return <MapPin className={iconClass} />;
    if (label.includes('cap') || label.includes('postal')) return <Hash className={iconClass} />;
    if (label.includes('paese') || label.includes('country')) return <MapPin className={iconClass} />;
    if (label.includes('prenotazione') || label.includes('booking')) return <Utensils className={iconClass} />;
    if (label.includes('ristorante') || label.includes('restaurant')) return <Utensils className={iconClass} />;
    if (label.includes('ordine') || label.includes('order')) return <Package className={iconClass} />;
    if (label.includes('prodott') || label.includes('item')) return <Package className={iconClass} />;
    if (label.includes('pagamento') || label.includes('payment')) return <CreditCard className={iconClass} />;
    if (label.includes('paziente') || label.includes('patient')) return <User className={iconClass} />;
    if (label.includes('appuntamento') || label.includes('appointment')) return <Stethoscope className={iconClass} />;
    if (label.includes('medico') || label.includes('doctor')) return <Stethoscope className={iconClass} />;
    if (node.type === 'string') return <Type className={iconClass} />;

    return <FileText className={iconClass} />;
  };

  /**
   * Calcola lo stato complessivo della pipeline per un task
   * - completed: tutte e 3 le fasi sono completate
   * - running: almeno una fase è in running
   * - pending: nessuna fase è partita
   */
  const getTaskStatus = (node: WizardTaskTreeNode): 'pending' | 'running' | 'completed' => {
    if (!node.pipelineStatus) return 'pending';

    const { constraints, parser, messages } = node.pipelineStatus;

    if (constraints === 'completed' && parser === 'completed' && messages === 'completed') {
      return 'completed';
    }

    if (constraints === 'running' || parser === 'running' || messages === 'running') {
      return 'running';
    }

    return 'pending';
  };

  /**
   * Calcola la percentuale di completamento per un task
   */
  const getTaskProgress = (node: WizardTaskTreeNode): string => {
    if (!node.pipelineStatus) return '';

    const { constraints, parser, messages, constraintsProgress = 0, parserProgress = 0, messagesProgress = 0 } = node.pipelineStatus;

    // Se tutto è pending, non mostrare nulla
    if (constraints === 'pending' && parser === 'pending' && messages === 'pending') {
      return '';
    }

    // Almeno una fase è attiva (running o completed)
    const isActive = constraints !== 'pending' || parser !== 'pending' || messages !== 'pending';

    if (!isActive) return '';

    // Calcola il progresso totale come media delle tre fasi
    let constraintsValue = 0;
    let parserValue = 0;
    let messagesValue = 0;

    if (constraints === 'completed') {
      constraintsValue = 100;
    } else if (constraints === 'running') {
      constraintsValue = constraintsProgress;
    }

    if (parser === 'completed') {
      parserValue = 100;
    } else if (parser === 'running') {
      parserValue = parserProgress;
    }

    if (messages === 'completed') {
      messagesValue = 100;
    } else if (messages === 'running') {
      messagesValue = messagesProgress;
    }

    // Media delle tre fasi
    const avgProgress = (constraintsValue + parserValue + messagesValue) / 3;
    return `${Math.round(avgProgress)}%`;
  };

  const renderNode = (node: WizardTaskTreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isActive = activeNodeId === node.id;
    const hasChildren = node.subNodes && node.subNodes.length > 0;
    const taskStatus = getTaskStatus(node);
    const progressText = getTaskProgress(node);

    return (
      <div key={node.id} className="space-y-1">
        <button
          ref={(el) => registerNode(node.id, el)}
          className={`
            w-full flex items-center justify-between rounded-xl px-3 py-2
            bg-white shadow-sm hover:shadow-md transition-all text-sm
            ${isActive ? 'ring-2 ring-blue-500' : ''}
          `}
          style={{
            marginLeft: `${level * 16}px`
          }}
          onClick={() => {
            onNodeClick(node.id);
            if (hasChildren) toggleNode(node.id);
          }}
        >
          <span className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <span onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </span>
            )}
            {!hasChildren && <div className="w-4" />}

            <span className="text-gray-600">{getNodeIcon(node)}</span>
            <span className="font-medium text-gray-800">{node.label}</span>
          </span>

          {/* Progress e indicatore di stato */}
          <span className="flex items-center gap-2">
            {progressText && (
              <span className="text-xs text-blue-600 font-semibold">
                {progressText}
              </span>
            )}
            {taskStatus === 'completed' && (
              <span className="text-green-500 text-sm">✔</span>
            )}
            {taskStatus === 'running' && (
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </span>
        </button>

        {hasChildren && isExpanded && (
          <div className="pl-6 space-y-1">
            {node.subNodes!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const shouldShowButton = showStructureConfirmation && !structureConfirmed && taskTree.length > 0;

  return (
    <aside className="w-72 border-r bg-gray-50 px-4 py-4 overflow-y-auto">
      <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        Struttura Task
      </div>

      {shouldShowButton && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-800 mb-2 text-center">
            Va bene questa struttura dati?
          </div>

          <div className="flex gap-2">
            <button
              onClick={onStructureConfirm}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow-md text-sm"
            >
              Sì
            </button>

            <button
              onClick={onStructureReject}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors shadow-sm hover:shadow-md text-sm"
            >
              No
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {taskTree.length > 0 ? (
          taskTree.map(node => renderNode(node))
        ) : (
          <div className="text-center text-gray-500 py-8 text-sm">
            Nessun task generato ancora
          </div>
        )}
      </div>
    </aside>
  );
}
