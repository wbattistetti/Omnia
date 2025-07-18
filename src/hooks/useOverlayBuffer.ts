import { useEffect, useState } from 'react';

export function useOverlayBuffer(labelRef: React.RefObject<HTMLElement>, iconPos: { top: number; left: number } | null, showIcons: boolean) {
  const [bufferRect, setBufferRect] = useState<{top: number, left: number, width: number, height: number} | null>(null);

  useEffect(() => {
    if (labelRef.current && iconPos) {
      const labelRect = labelRef.current.getBoundingClientRect();
      const overlayWidth = 44; // larghezza stimata overlay icone
      const buffer = 8; // px di tolleranza
      setBufferRect({
        top: labelRect.top - buffer,
        left: labelRect.left - buffer,
        width: (labelRect.width + overlayWidth + buffer * 2),
        height: Math.max(labelRect.height, 22) + buffer * 2
      });
    } else {
      setBufferRect(null);
    }
  }, [showIcons, iconPos, labelRef]);

  return bufferRect;
} 