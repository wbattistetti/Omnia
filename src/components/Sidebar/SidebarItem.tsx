import React, { useState } from 'react';
import { ProjectEntityItem } from '../../types/project';
import ItemEditor from './ItemEditor';
import DeleteConfirmation from './DeleteConfirmation';
import { Pencil, Trash2 } from 'lucide-react';

interface SidebarItemProps {
  item: ProjectEntityItem;
  onUpdate: (updates: Partial<ProjectEntityItem>) => void;
  onDelete: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-1 text-sm py-0.5 px-1 rounded min-h-[32px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDelete(false); }}
    >
      {editing ? (
        <ItemEditor
          value={item.name}
          onConfirm={(name) => {
            onUpdate({ name });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          placeholder="Edit item..."
        />
      ) : (
        <>
          <span className="truncate" style={{ color: 'var(--sidebar-content-text)' }}>{item.name}</span>
          <span className="flex items-center gap-1 ml-1" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
            <button
              className="p-1 text-gray-400 hover:text-blue-400"
              title="Modifica"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="p-1 text-red-500 hover:text-red-700"
              title="Elimina"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </span>
          {showDelete && (
            <DeleteConfirmation
              onConfirm={onDelete}
              triggerClass="hidden"
              icon={null}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SidebarItem;