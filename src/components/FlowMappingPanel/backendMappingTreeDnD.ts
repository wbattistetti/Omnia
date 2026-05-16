/**
 * Re-export shim: il modulo è implementato in `.tsx` (JSX). Mantiene compatibilità con URL HMR/cache `.ts`.
 */
export {
  DropPreviewLine,
  findBackendMapRowElementFromPoint,
  placementFromY,
  type DropPreviewTone,
} from './backendMappingTreeDnD.tsx';
