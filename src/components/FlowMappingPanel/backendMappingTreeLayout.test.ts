/**
 * Layout metriche albero backend SEND/RECEIVE.
 */

import { describe, expect, it } from 'vitest';
import {
  BACKEND_TREE_ARROW_SLOT_PX,
  BACKEND_TREE_CHEVRON_SLOT_PX,
  BACKEND_TREE_INDENT_PX,
  backendDominioValoriCleanTreeInsetPx,
  backendTreeDepthIndentPx,
} from './backendMappingTreeLayout';

describe('backendMappingTreeLayout', () => {
  it('depth indent scales with level', () => {
    expect(backendTreeDepthIndentPx(0)).toBe(0);
    expect(backendTreeDepthIndentPx(2)).toBe(2 * BACKEND_TREE_INDENT_PX);
  });

  it('dominio valori inset includes chevron + arrow + depth', () => {
    expect(
      backendDominioValoriCleanTreeInsetPx({
        depth: 1,
        showAdvancementUi: false,
        hasOpenApiDrift: false,
      })
    ).toBe(
      BACKEND_TREE_INDENT_PX + BACKEND_TREE_CHEVRON_SLOT_PX + BACKEND_TREE_ARROW_SLOT_PX
    );
  });

  it('arrow slot is double the legacy 40px width', () => {
    expect(BACKEND_TREE_ARROW_SLOT_PX).toBe(80);
  });
});
