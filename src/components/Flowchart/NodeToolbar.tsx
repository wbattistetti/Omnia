import React from 'react';
import { Trash2, Anchor, Edit3 } from 'lucide-react';

type NodeToolbarProps = {
  onDelete?: () => void;
  onEditTitle?: () => void;
  compact?: boolean; // quando header visibile: mostra solo controlli essenziali
  className?: string;
  style?: React.CSSProperties;
};

export const NodeToolbar: React.FC<NodeToolbarProps> = ({ onDelete, onEditTitle, compact, className, style }) => {
  return (
    <div
      className={`flex items-center gap-1.5 z-30 rounded-full px-2 py-1 ${className || ''}`}
      style={{ background: 'rgba(17,24,39,0.4)', border: '1px solid rgba(148,163,184,0.4)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', height: 18, alignItems: 'center', ...style }}
    >
      {/* conferma/annulla in modalità header editing saranno mostrati dall'header; qui solo matita/cestino/ancora */}
      <button
        className="p-0"
        title="Edit title"
        style={{ background: 'none', border: 'none' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { onEditTitle && onEditTitle(); } catch {} }}
      >
        <Edit3 className="w-3 h-3 text-slate-200 hover:text-green-400" />
      </button>
      <button
        className="p-0"
        title="Delete"
        style={{ background: 'none', border: 'none', marginLeft: 4 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try { onDelete && onDelete(); } catch {}
        }}
      >
        <Trash2 className="w-3 h-3 text-slate-200 hover:text-red-400" />
      </button>
      {!compact && (
        <div
          title="Drag to move with descendants"
          className="rigid-anchor"
          style={{ cursor: 'grab', marginLeft: 4 }}
          onMouseDown={() => { try { (window as any).__flowDragMode = 'rigid'; } catch {} }}
          onMouseUp={() => { try { (window as any).__flowDragMode = undefined; } catch {} }}
        >
          <Anchor className="w-3 h-3 text-slate-200" />
        </div>
      )}
    </div>
  );
};

export default NodeToolbar;


