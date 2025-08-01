import React from 'react';

/**
 * SidebarContainer: gestisce layout, larghezza, font-size, resize, scroll, sfondo.
 * TODO: Implementare logica resize con handle a destra.
 */
const SidebarContainer: React.FC<{
  width: number;
  fontSize: number;
  sidebarRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}> = ({ width, fontSize, sidebarRef, children }) => {
  return (
    <div
      ref={sidebarRef}
      style={{
        width,
        minWidth: 320,
        maxWidth: 600,
        fontSize,
        height: '100vh',
        background: '#1e293b', // bg-slate-800
        borderRight: '1px solid #334155', // border-slate-700
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      {/* TODO: Handle resize handle a destra (8px, cursore col-resize) */}
    </div>
  );
};

export default SidebarContainer;