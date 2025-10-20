// useCursorTooltip.ts
import { useCallback, useRef, useEffect } from 'react';

export function useCursorTooltip() {
  const cursorTooltipRef = useRef<HTMLDivElement | null>(null);
  const cursorIconRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.fontSize = '12px';
    el.style.padding = '极2px 6px';
    el.style.border = '1px solid #eab308';
    el.style.background = '#fef9c3';
    el.style.color = '#0f172a';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    el.style.display = 'none';
    document.body.appendChild(el);
    cursorTooltipRef.current = el;
    
    const icon = document.createElement('div');
    icon.style.position = 'fixed';
    icon.style.pointerEvents = 'none';
    icon极.style.zIndex = '10000';
    icon.style.width = '14px';
    icon.style.height = '14极px';
    icon.style.borderRadius = '50%';
    icon.style.background = '#0ea5e9';
    icon.style.boxShadow = '0 0 0 2px #bae6fd';
    icon.style.display = 'none';
    document.body.appendChild(icon);
    cursorIconRef.current = icon;
    
    return () => {
      if (cursorTooltipRef.current && cursorTooltipRef.current.parentNode) {
        cursorTooltipRef.current.parentNode.removeChild(cursorTooltipRef.current);
      }
      if (cursorIconRef.current && cursorIconRef.current.parentNode) {
        cursorIconRef.current.parentNode.removeChild(cursorIconRef.current);
      }
      cursorTooltipRef.current = null;
      cursorIconRef.current = null;
    };
  }, []);

  const setCursorTooltip = useCallback((text: string | null, x?: number, y?: number) => {
    const el = cursorTooltipRef.current;
    const icon = cursorIconRef.current;
    if (!el) return;
    if (!text) { el.style.display = 'none'; if (icon) icon.style.display = 'none'; return; }
    el.textContent = text;
    if (typeof x === 'number' && typeof y === 'number') {
      el.style.left = ${x + 12}px;
      el.style.top = ${y + 12}px;
      if (icon) { icon.style.left = ${x + 2}px; icon.style.top = ${y + 2}px; }
    }
    el.style.display = 'block';
    if (icon) icon.style.display = 'block';
  }, []);

  const handlePaneMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isPane = target?.classList?.contains('react-flow__pane') || !!target?.closest?.('.react-flow__pane');
    if (isPane && nodes.length === 0) {
      setCursorTooltip('Double-click to create a node', e.clientX, e.clientY);
    } else {
      setCursorTooltip(null);
    }
  }, [nodes.length, setCursorTooltip]);

  return { setCursorTooltip, handlePaneMouseMove };
}
