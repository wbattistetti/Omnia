import { describe, expect, it } from 'vitest';
import { commitEffectiveTextChange } from '../revisionCommitFromEffective';
import { applyOperations, commitOperations, createOtDocument } from '../otTextDocument';
import { diffToOps } from '../otDiffToOps';

describe('commitEffectiveTextChange', () => {
  it('returns noop when effective unchanged', () => {
    const r = commitEffectiveTextChange({
      baseText: 'hello',
      deletedMask: [],
      inserts: [],
      otMode: false,
      targetEffective: 'hello',
    });
    expect(r.kind).toBe('noop');
  });

  it('returns ot ops for ot mode edits', () => {
    const r = commitEffectiveTextChange({
      baseText: 'one',
      deletedMask: [],
      inserts: [],
      otMode: true,
      otCurrentText: 'one',
      targetEffective: 'two',
    });
    expect(r.kind).toBe('ot');
    if (r.kind === 'ot') expect(r.ops.length).toBeGreaterThan(0);
  });

  it('ot ops are relative to current text (incremental dictate / typing)', () => {
    const base = 'Chiedere al paziente.\n\n';
    let doc = createOtDocument(base);

    const r1 = commitEffectiveTextChange({
      baseText: base,
      deletedMask: [],
      inserts: [],
      otMode: true,
      otCurrentText: doc.currentText,
      targetEffective: `${base}Facciamo`,
    });
    expect(r1.kind).toBe('ot');
    if (r1.kind !== 'ot') return;
    doc = commitOperations(doc, r1.ops);
    expect(doc.currentText).toBe(`${base}Facciamo`);

    const r2 = commitEffectiveTextChange({
      baseText: base,
      deletedMask: [],
      inserts: [],
      otMode: true,
      otCurrentText: doc.currentText,
      targetEffective: `${base}Facciamo una cosa`,
    });
    expect(r2.kind).toBe('ot');
    if (r2.kind !== 'ot') return;
    doc = commitOperations(doc, r2.ops);
    expect(doc.currentText).toBe(`${base}Facciamo una cosa`);
    expect(doc.currentText).not.toMatch(/Facciamo\s+Facciamo/);
  });

  it('base-relative diff would duplicate when applied to current (regression guard)', () => {
    const base = 'Line\n\n';
    const current = `${base}Facciamo`;
    const target = `${base}Facciamo una`;
    const wrongOps = diffToOps(base, target);
    const duplicated = applyOperations(current, wrongOps);
    expect(duplicated).not.toBe(target);

    const rightOps = diffToOps(current, target);
    expect(applyOperations(current, rightOps)).toBe(target);
  });
});
