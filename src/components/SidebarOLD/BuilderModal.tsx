import React from 'react';
import DDTBuilder from '../DialogueDataTemplateBuilder/DDTBuilder';

// TODO: importa qui tutti i wizard reali (AgentActBuilder, UserActBuilder, ecc.)
const AgentActBuilder = (props: any) => { React.useState(null); return <div>AgentActBuilder (TODO)</div>; };
const UserActBuilder = (props: any) => { React.useState(null); return <div>UserActBuilder (TODO)</div>; };
const BackendActionBuilder = (props: any) => { React.useState(null); return <div>BackendActionBuilder (TODO)</div>; };
const ConditionBuilder = (props: any) => { React.useState(null); return <div>ConditionBuilder (TODO)</div>; };
const TaskBuilder = (props: any) => { React.useState(null); return <div>TaskBuilder (TODO)</div>; };
const MacrotaskBuilder = (props: any) => { React.useState(null); return <div>MacrotaskBuilder (TODO)</div>; };

/**
 * BuilderModal: sempre montato, invisible tabs, nessun key che causa remount.
 * TODO: collega i wizard reali, passa le props corrette.
 */
const BuilderModal: React.FC<{
  type: string | null;
  onCancel: () => void;
  onComplete?: (data: any) => void;
}> = ({ type, onCancel, onComplete }) => (
  <>
    <div style={{ display: type === 'ddt' ? 'block' : 'none' }}>
      <DDTBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'agentAct' ? 'block' : 'none' }}>
      <AgentActBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'userAct' ? 'block' : 'none' }}>
      <UserActBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'backendAction' ? 'block' : 'none' }}>
      <BackendActionBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'condition' ? 'block' : 'none' }}>
      <ConditionBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'task' ? 'block' : 'none' }}>
      <TaskBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
    <div style={{ display: type === 'macrotask' ? 'block' : 'none' }}>
      <MacrotaskBuilder onCancel={onCancel} onComplete={onComplete} />
    </div>
  </>
);

export default BuilderModal;