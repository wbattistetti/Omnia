import React from 'react';
import { Layers, CheckSquare, Square, Search, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * SidebarHeader: mostra titolo progetto, icone grandi, search bar, collapse.
 * TODO: Permettere editing titolo progetto.
 */
const SidebarHeader: React.FC<{
  onToggleCollapse: () => void;
  children?: React.ReactNode;
}> = ({ onToggleCollapse, children }) => {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #111', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', padding: '16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ borderRadius: '50%', background: '#ede9fe', padding: 12, border: '1px solid #c4b5fd' }}>
            <Layers className="w-7 h-7 text-violet-700" />
          </div>
          <span style={{ fontSize: 12, color: '#6d28d9', marginTop: 4 }}>MacroTask</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ borderRadius: '50%', background: '#dbeafe', padding: 12, border: '1px solid #93c5fd' }}>
            <CheckSquare className="w-7 h-7 text-blue-700" />
          </div>
          <span style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>Task</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ borderRadius: '50%', background: '#f3f4f6', padding: 12, border: '1px solid #d1d5db' }}>
            <Square className="w-7 h-7 text-gray-700" />
          </div>
          <span style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Nodo</span>
        </div>
        <button onClick={onToggleCollapse} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
          {/* TODO: Collapse/expand dinamico */}
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
      </div>
      {/* Search bar */}
      <div style={{ position: 'relative', margin: '8px 16px' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Search entities..."
          style={{
            width: '100%',
            padding: '8px 8px 8px 36px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            color: '#111',
            background: '#fff',
            fontSize: 15,
          }}
        />
      </div>
      {children}
    </div>
  );
};

export default SidebarHeader;