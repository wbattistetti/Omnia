import React, { ReactNode } from 'react';

interface SidebarContainerProps {
  children: ReactNode;
}

const SidebarContainer: React.FC<SidebarContainerProps> = ({ children }) => {
  return (
    <div
      className="h-screen border-r border-slate-700 flex flex-col resize-x overflow-hidden"
      style={{ minWidth: 320, maxWidth: 600 }}
    >
      {children}
    </div>
  );
};

export default SidebarContainer;