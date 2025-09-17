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
    const next = {
      ...connectionMenu,
      show: true,
      position,
      sourceNodeId,
      sourceHandleId,
      targetNodeId: null,
      targetHandleId: null,
      tempNodeId: null,
      tempEdgeId: null,
    };
    setMenu(next);
  }, [connectionMenu, setMenu]);

  const closeMenu = useCallback(() => {
    const next = {
      ...connectionMenu,
      show: false,
      position: { x: 0, y: 0 },
      sourceNodeId: null,
      sourceHandleId: null,
      targetNodeId: null,
      targetHandleId: null,
      tempNodeId: null,
      tempEdgeId: null,
    };
    setMenu(next);
  }, [connectionMenu, setMenu]);

  const setSource = useCallback((sourceNodeId, sourceHandleId) => {
    const next = { ...connectionMenu, sourceNodeId, sourceHandleId };
    setMenu(next);
  }, [connectionMenu, setMenu]);

  const setTarget = useCallback((targetNodeId, targetHandleId) => {
    const next = { ...connectionMenu, targetNodeId, targetHandleId };
    setMenu(next);
  }, [connectionMenu, setMenu]);

  const setTemp = useCallback((tempNodeId, tempEdgeId) => {
    const next = { ...connectionMenu, tempNodeId, tempEdgeId };
    setMenu(next);
  }, [connectionMenu, setMenu]);

  const setPosition = useCallback((position) => {
    const next = { ...connectionMenu, position };
    setMenu(next);
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