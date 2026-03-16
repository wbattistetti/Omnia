// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { CSSProperties } from 'react';

export interface Theme {
  background: string;
  border: string;
  text: string;
  itemBackground: string;
  itemBorder: string;
  placeholder: string;
  selectedBackground: string;
  hoverBackground: string;
}

export const createTheme = (editorMode: 'text' | 'graph'): Theme => {
  if (editorMode === 'graph') {
    return {
      background: '#121621',
      border: '#252a3e',
      text: '#e5e7eb',
      itemBackground: 'rgba(156,163,175,0.25)',
      itemBorder: '#334155',
      placeholder: '#9ca3af',
      selectedBackground: 'rgba(74, 158, 255, 0.2)',
      hoverBackground: 'rgba(156,163,175,0.15)',
    };
  }

  return {
    background: '#ffffff',
    border: '#e5e7eb',
    text: '#000000',
    itemBackground: '#fff',
    itemBorder: '#d1d5db',
    placeholder: '#6b7280',
    selectedBackground: '#eff6ff',
    hoverBackground: '#f9fafb',
  };
};

export const treeNodeStyle = (theme: Theme, level: number, isSelected: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  paddingLeft: `${8 + level * 16}px`,
  fontSize: '12px',
  color: theme.text,
  cursor: 'pointer',
  backgroundColor: isSelected ? theme.selectedBackground : 'transparent',
  borderRadius: '4px',
  marginBottom: '2px',
  userSelect: 'none',
  transition: 'background-color 0.15s',
});

export const treeNodeHoverStyle = (theme: Theme): CSSProperties => ({
  backgroundColor: theme.hoverBackground,
});

export const iconStyle: CSSProperties = {
  width: '14px',
  height: '14px',
  marginRight: '6px',
  flexShrink: 0,
};

export const labelStyle = (theme: Theme): CSSProperties => ({
  flex: 1,
  color: theme.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const expandIconStyle: CSSProperties = {
  width: '12px',
  height: '12px',
  marginRight: '4px',
  flexShrink: 0,
  cursor: 'pointer',
  transition: 'transform 0.2s',
};

export const addNodeStyle = (theme: Theme, level: number): CSSProperties => ({
  ...treeNodeStyle(theme, level, false),
  color: theme.placeholder,
  fontStyle: 'italic',
  // Compensate for missing chevron (12px width + 4px margin = 16px)
  // so gray icon aligns with colored icon above
  paddingLeft: `${8 + level * 16 + 16}px`,
});

export const editingInputStyle = (theme: Theme): CSSProperties => ({
  flex: 1,
  padding: '2px 6px',
  fontSize: '12px',
  border: `1px solid ${theme.border}`,
  borderRadius: '4px',
  backgroundColor: theme.background,
  color: theme.text,
  outline: 'none',
  fontFamily: 'inherit',
});

export const validationErrorStyle = (theme: Theme): CSSProperties => ({
  fontSize: '11px',
  color: '#dc2626',
  marginTop: '2px',
  paddingLeft: '20px',
});

export const validationWarningStyle = (theme: Theme): CSSProperties => ({
  fontSize: '11px',
  color: '#f59e0b',
  marginTop: '2px',
  paddingLeft: '20px',
});

export const suggestionStyle = (theme: Theme): CSSProperties => ({
  fontSize: '11px',
  color: theme.placeholder,
  marginTop: '2px',
  paddingLeft: '20px',
  fontStyle: 'italic',
});

export const suggestionItemStyle = (theme: Theme): CSSProperties => ({
  ...suggestionStyle(theme),
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: '2px',
  marginLeft: '4px',
  display: 'inline-block',
});

export const suggestionItemHoverStyle = (theme: Theme): CSSProperties => ({
  backgroundColor: theme.hoverBackground,
});
