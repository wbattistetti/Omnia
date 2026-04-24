import { describe, it, expect } from 'vitest';
import {
  splitConstraintsToMustMustNot,
  structuredDesignForPipelinePhase3,
} from '../structuredDesignForPipeline';

describe('structuredDesignForPipeline', () => {
  it('splitConstraintsToMustMustNot parses Must / Must not blocks', () => {
    const t =
      "Must: Chiedere all'utente di scegliere una data nei prossimi tre mesi. Must not: Scegliere una data al posto dell'utente.";
    const r = splitConstraintsToMustMustNot(t);
    expect(r.must).toContain('tre mesi');
    expect(r.must_not).toContain("posto dell'utente");
  });

  it('structuredDesignForPipelinePhase3 fills missing tokens for empty sections', () => {
    const sd = structuredDesignForPipelinePhase3({});
    expect(sd.goal).toBe('missing');
    expect(sd.constraints.must).toBe('missing');
  });
});
