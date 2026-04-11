import { describe, expect, it } from 'vitest';
import {
  isMinimalVariableRow,
  isUtteranceVariableMetadata,
  PROJECT_VARIABLE_METADATA_TYPE,
  reconstructVariableInstanceFromMinimalDoc,
  UTTERANCE_VARIABLE_METADATA_TYPE,
} from '../utteranceVariablePersistence';

describe('utteranceVariablePersistence', () => {
  it('detects utterance metadata', () => {
    expect(isUtteranceVariableMetadata({ type: UTTERANCE_VARIABLE_METADATA_TYPE })).toBe(true);
    expect(isUtteranceVariableMetadata({ type: 'manual' })).toBe(false);
    expect(isUtteranceVariableMetadata(null)).toBe(false);
  });

  it('detects minimal variable rows', () => {
    expect(isMinimalVariableRow({ metadata: { type: PROJECT_VARIABLE_METADATA_TYPE } })).toBe(true);
    expect(isMinimalVariableRow({ metadata: {} })).toBe(false);
  });

  it('reconstructs project-scope row', () => {
    const v = reconstructVariableInstanceFromMinimalDoc({
      id: 'a',
      metadata: { type: PROJECT_VARIABLE_METADATA_TYPE },
    });
    expect(v?.scope).toBe('project');
    expect(v?.id).toBe('a');
  });

  it('returns null for utterance (hydration path)', () => {
    expect(
      reconstructVariableInstanceFromMinimalDoc({
        id: 'u',
        metadata: { type: UTTERANCE_VARIABLE_METADATA_TYPE },
      })
    ).toBeNull();
  });
});
