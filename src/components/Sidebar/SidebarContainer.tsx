import React, { ReactNode } from 'react';
import ResizeHandle from '../common/ResizeHandle';
import { useResizablePanel } from '../../hooks/useResizablePanel';

interface SidebarContainerProps {
  children: ReactNode;
}

const SidebarContainer: React.FC<SidebarContainerProps> = ({ children }) => {
  const { size, handleResize, style } = useResizablePanel({
    initialSize: 400,
    min: 320,
    max: 600,
    direction: 'horizontal',
    persistKey: 'sidebar-width'
  });

  return (
    <div
      className="h-screen border-r border-slate-700 flex flex-col overflow-hidden"
      style={{ 
        ...style,
        minWidth: 320,
        maxWidth: 600,
        background: 'var(--sidebar-bg)', 
        color: 'var(--sidebar-content-text)',
        position: 'relative'
      }}
    >
      {children}
      <ResizeHandle
        direction="horizontal"
        position="right"
        onResize={handleResize}
        min={320}
        max={600}
        initialSize={size}
        persistKey="sidebar-width"
      />
    </div>
  );
};

export default SidebarContainer;