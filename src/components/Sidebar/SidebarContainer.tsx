import React, { ReactNode } from 'react';
import ResizeHandle from '../common/ResizeHandle';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import { useFontClasses } from '../../hooks/useFontClasses';

interface SidebarContainerProps {
  children: ReactNode;
}

const SidebarContainer: React.FC<SidebarContainerProps> = ({ children }) => {
  const { size, handleResize, style } = useResizablePanel({
    initialSize: 400,
    min: 320,
    max: 1000, // ✅ Aumentato da 600 a 1000 per permettere più spazio al testo
    direction: 'horizontal',
    persistKey: 'sidebar-width'
  });
  // ✅ Applica font globali dallo store
  const { combinedClass } = useFontClasses();

  return (
    <div
      className={`h-screen border-r border-slate-700 flex flex-col overflow-hidden ${combinedClass}`}
      style={{
        ...style,
        minWidth: 320,
        maxWidth: 1000, // ✅ Aumentato da 600 a 1000
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
        max={1000}
        initialSize={size}
        persistKey="sidebar-width"
      />
    </div>
  );
};

export default SidebarContainer;