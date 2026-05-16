/**
 * Tipi condivisi per l’albero mapping backend (Arborist).
 */

import type React from 'react';

export type BackendSendAdvancementApi = {
  isEnabled: (wireKey: string) => boolean;
  onToggle: (wireKey: string, next: boolean) => void;
  renderEditor: (wireKey: string) => React.ReactNode;
};
