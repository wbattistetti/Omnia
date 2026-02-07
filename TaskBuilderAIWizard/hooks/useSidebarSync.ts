import { useEffect, useRef } from 'react';

export function useSidebarSync(activeNodeId: string | null) {
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerNode = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      nodeRefs.current.set(id, element);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  useEffect(() => {
    if (activeNodeId) {
      const element = nodeRefs.current.get(activeNodeId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-active');
        setTimeout(() => {
          element.classList.remove('highlight-active');
        }, 2000);
      }
    }
  }, [activeNodeId]);

  return {
    registerNode
  };
}
