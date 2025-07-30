import React, { useState, useRef, isValidElement, cloneElement } from 'react';

export const TooltipWrapper: React.FC<{
  tooltip: React.ReactNode;
  children: (show: boolean, triggerProps: any) => React.ReactNode;
}> = ({ tooltip, children }) => {
  const [show, setShow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Clona il tooltip e aggiunge onClose se è un React element
  const tooltipWithClose = isValidElement(tooltip)
    ? cloneElement(tooltip, { onClose: () => setShow(false) })
    : tooltip;

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 1500);
  };
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children(show, {})}
      {show && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100 }}>
          {tooltipWithClose}
        </div>
      )}
    </div>
  );
}; 