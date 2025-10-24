import React from 'react';
import { Trash2, Anchor, Edit3, Move } from 'lucide-react';

type NodeToolbarProps = {
  onDelete?: () => void;
  onEditTitle?: () => void;
  compact?: boolean; // quando header visibile: mostra solo controlli essenziali
  className?: string;
  style?: React.CSSProperties;
  toolbarRef?: React.RefObject<HTMLDivElement>;
};

export const NodeToolbar: React.FC<NodeToolbarProps> = ({ onDelete, onEditTitle, compact, className, style, toolbarRef }) => {
  return (
    <div
      ref={toolbarRef}
      className={`flex items-center gap-1.5 z-30 rounded-full px-2 py-1 ${className || ''}`}
      style={{
        background: 'rgba(17,24,39,0.0)', // fully transparent
        backdropFilter: 'blur(2px) saturate(120%)', // subtle overlayed effect
        WebkitBackdropFilter: 'blur(2px) saturate(120%)',
        border: 'none', // remove thin border
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        height: 18,
        alignItems: 'center',
        ...style
      }}
    >
      {/* Icona Move (4 frecce) per trascinare il nodo - NON ha 'nodrag' quindi è draggable */}
      <div
        title="Drag to move node"
        style={{ 
          cursor: 'grab', 
          opacity: 0.85, 
          transition: 'opacity 120ms linear', 
          display: 'flex', 
          alignItems: 'center',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.cursor = 'grab'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
        onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.cursor = 'grabbing'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = 'grab'; }}
      >
        <Move className="w-3 h-3 text-slate-200 hover:text-amber-300 transition transform hover:scale-110 drop-shadow hover:drop-shadow-lg" />
      </div>
      
      {/* conferma/annulla in modalità header editing saranno mostrati dall'header; qui solo matita/cestino/ancora */}
      <button
        className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
        title="Edit title"
        style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { onEditTitle && onEditTitle(); } catch {} }}
      >
        <Edit3 className="w-3 h-3 text-slate-200 hover:text-amber-300 drop-shadow hover:drop-shadow-lg transition-colors" />
      </button>
      <button
        className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
        title="Delete"
        style={{ background: 'none', border: 'none', marginLeft: 4, opacity: 0.85, transition: 'opacity 120ms linear' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try { onDelete && onDelete(); } catch {}
        }}
      >
        <Trash2 className="w-3 h-3 text-slate-200 hover:text-red-400 drop-shadow hover:drop-shadow-lg transition-colors" />
      </button>
      {!compact && (
        <div
          title="Drag to move with descendants"
          className="rigid-anchor nodrag"
          style={{ cursor: 'grab', marginLeft: 4, opacity: 0.85, transition: 'opacity 120ms linear' }}
          onMouseDown={() => { try { (window as any).__flowDragMode = 'rigid'; } catch {} }}
          onMouseUp={() => { try { (window as any).__flowDragMode = undefined; } catch {} }}
        >
          <Anchor className="w-3 h-3 text-slate-200 hover:text-amber-300 transition transform hover:scale-110 drop-shadow hover:drop-shadow-lg" />
        </div>
      )}
    </div>
  );
};

export default NodeToolbar;


