import React from 'react';
import ResponseEditorUI from './ResponseEditorUI';
import { FileText, Calendar, Mail, MapPin, PlayCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle } from 'lucide-react';
import { TreeNodeProps } from './types';
import { createAction } from './actionFactories';
import { createParameter } from './parameterFactories';
import { estraiNodiDaDDT, insertNodeAt } from './treeFactories';
import { useResponseEditorState } from './useResponseEditorState';

interface ResponseEditorBodyProps {
  ddt: any;
  translations: any;
  lang: string;
  onClose?: () => void;
}

const ResponseEditorBody: React.FC<ResponseEditorBodyProps> = ({ ddt, translations, lang, onClose }) => {
  const {
    state,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo
  } = useResponseEditorState();

  const [showSimulator, setShowSimulator] = React.useState(false);
  const handleToggleSimulator = () => setShowSimulator(v => !v);

  const { selectedStep, nodes } = state;
  const stepKeys = ddt && ddt.steps ? Object.keys(ddt.steps) : [];

  // History management for local UI actions (kept minimal)
  const historyRef = React.useRef<any[]>([]);
  const indexRef = React.useRef(0);

  const dispatchWithHistory = React.useCallback((action: any) => {
    const newState = action;
    if (JSON.stringify(newState) !== JSON.stringify(state)) {
      const newHistory = historyRef.current.slice(0, indexRef.current + 1);
      newHistory.push(state);
      historyRef.current = newHistory;
      indexRef.current = newHistory.length - 1;
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50);
        indexRef.current = historyRef.current.length - 1;
      }
    }
    dispatch(action);
  }, [state, dispatch]);

  React.useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(data => dispatchWithHistory({ type: 'SET_ACTION_CATALOG', catalog: data }));
  }, [dispatchWithHistory]);

  // Build nodes from DDT whenever it changes
  React.useEffect(() => {
    const estratti = estraiNodiDaDDT(ddt?.mainData, translations, lang);
    dispatchWithHistory({ type: 'SET_NODES', nodes: estratti });
  }, [ddt, translations, lang, dispatchWithHistory]);

  // Filter nodes by selected step
  let filteredNodes: TreeNodeProps[] = [];
  if (selectedStep) {
    const escalationNodes = nodes.filter(n => n.type === 'escalation' && n.stepType === selectedStep);
    const escalationIds = escalationNodes.map(n => n.id);
    const childNodes = nodes.filter(n => n.parentId && escalationIds.includes(n.parentId));
    filteredNodes = [...escalationNodes, ...childNodes];
  }

  const handleDrop = (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => {
    if (item && item.action) {
      const action = item.action;
      const id = Math.random().toString(36).substr(2, 9);
      const newNode: TreeNodeProps = createAction({
        id,
        text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        type: 'action',
        icon: item.icon,
        color: item.color,
        label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        primaryValue: item.primaryValue,
        parameters: item.parameters ? item.parameters.map(createParameter) : undefined,
      });
      if (targetId === null) {
        dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
      } else {
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        } else if (targetNode.type === 'escalation' && position === 'child') {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id } });
        } else if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
          const inserted = insertNodeAt(nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else if (targetNode.type === 'action') {
          const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
          const inserted = insertNodeAt(nodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos);
          dispatchWithHistory({ type: 'SET_NODES', nodes: inserted });
        } else {
          dispatchWithHistory({ type: 'ADD_NODE', node: { ...newNode, level: 0, parentId: undefined } });
        }
      }
      return id;
    }
    return null;
  };

  const removeNode = (id: string) => {
    if (typeof id !== 'string') return;
    dispatchWithHistory({ type: 'REMOVE_NODE', id });
  };

  const handleAddEscalation = () => {
    dispatchWithHistory({ type: 'ADD_ESCALATION' });
  };

  const getDDTIcon = (type: string) => {
    if (!type) return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
    const t = type.toLowerCase();
    if (t === 'date') return <Calendar className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'email') return <Mail className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'address') return <MapPin className="w-5 h-5 text-fuchsia-100 mr-2" />;
    return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
  };

  const stepMeta: Record<string, { icon: JSX.Element; label: string; border: string; bg: string; color: string; bgActive: string }> = {
    start:        { icon: <PlayCircle size={17} />,        label: 'Chiedo il dato',      border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
    noMatch:      { icon: <AlertCircle size={17} />,        label: 'Non capisco',         border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
    noInput:      { icon: <MicOff size={17} />,            label: 'Non sento',           border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
    confirmation: { icon: <CheckCircle2 size={17} />,      label: 'Devo confermare',     border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
    success:      { icon: <CheckSquare size={17} />,       label: 'Ho capito!',           border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
    notAcquired:  { icon: <AlertCircle size={17} />,       label: 'Dato non acquisito',  border: '#f59e42', bg: 'rgba(245,158,66,0.08)', color: '#f59e42', bgActive: 'rgba(245,158,66,0.18)' },
    notConfirmed: { icon: <AlertCircle size={17} />,       label: 'Non confermato',      border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
  };

  const onStepChange = (step: string) => dispatchWithHistory({ type: 'SET_STEP', step });
  const onShowLabelChange = (show: boolean) => dispatchWithHistory({ type: 'SET_SHOW_LABEL', show });

  const ddtType = ddt?.dataType?.type;
  const ddtLabel = ddt?.label || ddt?.name || '—';

  const editorStateForUI = {
    ...state,
    ddtType,
    ddtLabel,
    ddt,
    onStepChange,
    onShowLabelChange,
  };

  const handleToggleInclude = (id: string, included: boolean) => {
    dispatchWithHistory({ type: 'TOGGLE_ESCALATION_INCLUDE', id, included });
  };

  const [selectedNodeIndex, setSelectedNodeIndex] = React.useState<number | null>(null);
  function getNodeByIndex(mainData: any, index: any) {
    if (index == null) return mainData;
    if (!mainData.subData || !mainData.subData[index]) return mainData;
    return mainData.subData[index];
  }

  const selectedNode = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
  const ddtForUI = ddt ? {
    ...ddt,
    steps: Object.fromEntries(
      (selectedNode?.steps || []).map((stepGroup: any) => [
        stepGroup.type,
        (stepGroup.escalations || []).map((escalation: any) => ({
          type: 'escalation',
          id: escalation.escalationId,
          actions: escalation.actions
        }))
      ])
    )
  } : ddt;

  let uiStepKeys = ddtForUI?.steps ? Object.keys(ddtForUI.steps) : [];
  const v2Main = ddt?.v2Draft?.['__main__'];
  const hasNotConfirmedV2 = Boolean(v2Main?.notConfirmed?.prompts && v2Main.notConfirmed.prompts.length === 3);
  const isMainSelected = selectedNodeIndex == null;
  if (isMainSelected && hasNotConfirmedV2 && !uiStepKeys.includes('notConfirmed')) {
    uiStepKeys = [...uiStepKeys, 'notConfirmed'];
  }

  React.useEffect(() => {
    const mainData = ddt?.mainData || {};
    const node = getNodeByIndex(mainData, selectedNodeIndex);
    if (node && node.steps) {
      node.steps.forEach((_step: any) => {});
    }
  }, [selectedNodeIndex, ddt]);

  React.useEffect(() => {
    const node = getNodeByIndex(ddt?.mainData || {}, selectedNodeIndex);
    const estratti = estraiNodiDaDDT(node, translations, lang);
    dispatchWithHistory({ type: 'SET_NODES', nodes: estratti });
  }, [selectedNodeIndex, translations, lang, ddt, dispatchWithHistory]);

  const handleSelectNode = (index: number | null) => {
    setSelectedNodeIndex(index);
    const node = getNodeByIndex(ddt?.mainData || {}, index);
    const availableSteps = node?.steps?.map((s: any) => s.type) || [];
    if (selectedStep && !availableSteps.includes(selectedStep)) {
      if (availableSteps.length > 0) dispatchWithHistory({ type: 'SET_STEP', step: availableSteps[0] });
      else dispatchWithHistory({ type: 'SET_STEP', step: '' as any });
    }
  };

  const handleAIGenerate = async (_actionId: string, _exampleMessage: string, _applyToAll: boolean) => {
    // Placeholder for future AI integration within the editor body
    return;
  };

  return (
    <ResponseEditorUI
      editorState={editorStateForUI}
      filteredNodes={filteredNodes}
      stepKeys={uiStepKeys}
      stepMeta={stepMeta}
      handleDrop={handleDrop}
      removeNode={removeNode}
      handleAddEscalation={handleAddEscalation}
      handleUndo={undo}
      handleRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      getDDTIcon={getDDTIcon}
      onClose={onClose || (() => {})}
      onToggleInclude={handleToggleInclude}
      selectedNodeIndex={selectedNodeIndex}
      onSelectNode={handleSelectNode}
      onAIGenerate={handleAIGenerate}
      selectedStep={selectedStep || undefined}
      onToggleSimulator={handleToggleSimulator}
      showSimulator={showSimulator}
    />
  );
};

export default ResponseEditorBody;
