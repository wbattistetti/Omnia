import { describe, expect, it } from 'vitest';
import {
  resolveBackendToolDescriptionAfterReadApi,
  resolveIoFieldDescriptionFromOpenApi,
} from '../runBackendCallReadApiForTask';

describe('resolveIoFieldDescriptionFromOpenApi', () => {
  it('preserves local description when not forcing overwrite', () => {
    expect(
      resolveIoFieldDescriptionFromOpenApi('Testo locale', 'Da OpenAPI', false)
    ).toBe('Testo locale');
  });

  it('fills from OpenAPI when local is empty', () => {
    expect(resolveIoFieldDescriptionFromOpenApi('', 'Da OpenAPI', false)).toBe('Da OpenAPI');
  });

  it('overwrites local with OpenAPI on force refresh', () => {
    expect(
      resolveIoFieldDescriptionFromOpenApi('Testo locale', 'Da OpenAPI', true)
    ).toBe('Da OpenAPI');
  });

  it('clears local when force refresh and OpenAPI has no description', () => {
    expect(resolveIoFieldDescriptionFromOpenApi('Testo locale', '', true)).toBeUndefined();
  });
});

describe('resolveBackendToolDescriptionAfterReadApi', () => {
  it('does not update when local exists and not force refresh', () => {
    expect(
      resolveBackendToolDescriptionAfterReadApi('Vecchia', 'Nuova da spec', false)
    ).toBeUndefined();
  });

  it('fills when empty and not force refresh', () => {
    expect(resolveBackendToolDescriptionAfterReadApi('', 'Nuova da spec', false)).toBe(
      'Nuova da spec'
    );
  });

  it('overwrites on force refresh even when local exists', () => {
    expect(
      resolveBackendToolDescriptionAfterReadApi('Vecchia', 'Nuova da spec', true)
    ).toBe('Nuova da spec');
  });

  it('clears on force refresh when spec has no blurb', () => {
    expect(resolveBackendToolDescriptionAfterReadApi('Vecchia', '', true)).toBe('');
  });
});
