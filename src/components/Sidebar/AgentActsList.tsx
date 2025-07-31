import React from 'react';

interface AgentAct {
  id: string;
  label: string;
}

const AgentActsList: React.FC<{
  agentActs: AgentAct[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ agentActs, onEdit, onDelete }) => (
  <div>
    {agentActs.map(act => (
      <div key={act.id} className="flex items-center justify-between p-2">
        <span>{act.label}</span>
        <div>
          <button onClick={() => onEdit(act.id)} title="Modifica">✏️</button>
          <button onClick={() => onDelete(act.id)} title="Elimina">🗑️</button>
        </div>
      </div>
    ))}
  </div>
);

export default AgentActsList;