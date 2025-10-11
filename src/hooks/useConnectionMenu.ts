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
    try { console.log('[ConnMenu][open]', { position, sourceNodeId, sourceHandleId }); } catch {}
    const cur = connectionMenuRef.current;
    const next = {
      ...cur,
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
  }, [setMenu]);

  const closeMenu = useCallback(() => {
    try { console.log('[ConnMenu][close]'); } catch {}
    const cur = connectionMenuRef.current;
    const next = {
      ...cur,
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
  }, [setMenu]);

  const setSource = useCallback((sourceNodeId, sourceHandleId) => {
    const cur = connectionMenuRef.current;
    const next = { ...cur, sourceNodeId, sourceHandleId };
    setMenu(next);
  }, [setMenu]);

  const setTarget = useCallback((targetNodeId, targetHandleId) => {
    const cur = connectionMenuRef.current;
    const next = { ...cur, targetNodeId, targetHandleId };
    setMenu(next);
  }, [setMenu]);

  const setTemp = useCallback((tempNodeId, tempEdgeId) => {
    try { console.log('[ConnMenu][setTemp]', { tempNodeId, tempEdgeId }); } catch {}
    const cur = connectionMenuRef.current;
    const next = { ...cur, tempNodeId, tempEdgeId };
    setMenu(next);
  }, [setMenu]);

  const setPosition = useCallback((position) => {
    const cur = connectionMenuRef.current;
    const next = { ...cur, position };
    setMenu(next);
  }, [setMenu]);

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