import { useState, useEffect } from 'react';

export function useOverlayBuffer(
  labelRef: React.RefObject<HTMLSpanElement>,
  iconPos: { top: number; left: number } | null,
  showIcons: boolean
) {
  const [bufferRect, setBufferRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (showIcons && labelRef.current && iconPos) {
      const labelRect = labelRef.current.getBoundingClientRect();
      setBufferRect({
        top: labelRect.top,
        left: labelRect.right,
        width: iconPos.left - labelRect.right + 32, // 32px di tolleranza
        height: labelRect.height,
        right: iconPos.left + 32,
        bottom: labelRect.bottom,
        x: labelRect.right,
        y: labelRect.top,
        toJSON: () => ({})
      } as DOMRect);
    } else {
      setBufferRect(null);
    }
  }, [showIcons, labelRef, iconPos]);

  return bufferRect;
} 