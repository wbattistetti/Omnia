import React, { createContext, useContext, ReactNode, useState } from 'react';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_FONT_SIZES } from './sidebarTheme';

const SIDEBAR_TYPE_COLORS_DARK = {
  agentActs: { main: '#c4b5fd', light: '#4c1d95' },
  userActs: { main: '#6ee7b7', light: '#065f46' },
  backendActions: { main: '#7dd3fc', light: '#0369a1' },
  conditions: { main: '#fde68a', light: '#92400e' },
  tasks: { main: '#fdba74', light: '#7c2d12' },
  macrotasks: { main: '#fca5a5', light: '#7f1d1d' },
};

interface SidebarThemeContextProps {
  colors: typeof SIDEBAR_TYPE_COLORS;
  icons: typeof SIDEBAR_TYPE_ICONS;
  fontSizes: typeof SIDEBAR_FONT_SIZES;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const SidebarThemeContext = createContext<SidebarThemeContextProps | undefined>(undefined);

export const SidebarThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const colors = theme === 'light' ? SIDEBAR_TYPE_COLORS : SIDEBAR_TYPE_COLORS_DARK;
  return (
    <SidebarThemeContext.Provider value={{
      colors,
      icons: SIDEBAR_TYPE_ICONS,
      fontSizes: SIDEBAR_FONT_SIZES,
      theme,
      setTheme,
    }}>
      {children}
    </SidebarThemeContext.Provider>
  );
};

export function useSidebarTheme() {
  const ctx = useContext(SidebarThemeContext);
  if (!ctx) throw new Error('useSidebarTheme must be used within a SidebarThemeProvider');
  return ctx;
} 