import { useState, useRef, useCallback } from 'react';

export function useConnectionMenu() {
  const [connectionMenu, setConnectionMenu] = useState({
    show: false,
    position: { x: 0, y: 0 },
    sourceNodeId: null,
    sourceHandleId: null,
    targetNodeId: null,
    targetHandleId: null,
    tempNodeId: null,
    tempEdgeId: null,
  });
  const connectionMenuRef = useRef(connectionMenu);

  // Aggiorna ref ogni volta che cambia lo stato
  const setMenu = useCallback((menu) => {
    setConnectionMenu(menu);
    connectionMenuRef.current = menu;
  }, []);

  const openMenu = useCallback((position, sourceNodeId, sourceHandleId) => {
    setMenu({
      ...connectionMenu,
      show: true,
      position,
      sourceNodeId,
      sourceHandleId,
      targetNodeId: null,
      targetHandleId: null,
      tempNodeId: null,
      tempEdgeId: null,
    });
  }, [connectionMenu, setMenu]);

  const closeMenu = useCallback(() => {
    setMenu({
      ...connectionMenu,
      show: false,
      position: { x: 0, y: 0 },
      sourceNodeId: null,
      sourceHandleId: null,
      targetNodeId: null,
      targetHandleId: null,
      tempNodeId: null,
      tempEdgeId: null,
    });
  }, [connectionMenu, setMenu]);

  const setSource = useCallback((sourceNodeId, sourceHandleId) => {
    setMenu({ ...connectionMenu, sourceNodeId, sourceHandleId });
  }, [connectionMenu, setMenu]);

  const setTarget = useCallback((targetNodeId, targetHandleId) => {
    setMenu({ ...connectionMenu, targetNodeId, targetHandleId });
  }, [connectionMenu, setMenu]);

  const setTemp = useCallback((tempNodeId, tempEdgeId) => {
    setMenu({ ...connectionMenu, tempNodeId, tempEdgeId });
  }, [connectionMenu, setMenu]);

  const setPosition = useCallback((position) => {
    setMenu({ ...connectionMenu, position });
  }, [connectionMenu, setMenu]);

  return {
    connectionMenu,
    setMenu,
    openMenu,
    closeMenu,
    setSource,
    setTarget,
    setTemp,
    setPosition,
    connectionMenuRef,
  };
} 