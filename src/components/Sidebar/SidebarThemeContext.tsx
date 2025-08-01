import React, { createContext, useContext } from 'react';
import { sidebarTheme } from './sidebarTheme';

const SidebarThemeContext = createContext(sidebarTheme);

export const SidebarThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SidebarThemeContext.Provider value={sidebarTheme}>
      {children}
    </SidebarThemeContext.Provider>
  );
};

export const useSidebarTheme = () => useContext(SidebarThemeContext);