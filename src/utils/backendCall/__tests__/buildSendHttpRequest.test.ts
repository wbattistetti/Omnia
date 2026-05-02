import { describe, expect, it } from 'vitest';
import { createMappingEntry, type MappingEntry } from '../../../components/FlowMappingPanel/mappingTypes';
import { buildSendHttpRequest } from '../buildSendHttpRequest';

function entry(wire: string, api: string): MappingEntry {
  return createMappingEntry({ wireKey: wire, apiField: api, literalConstant: 'x' });
}

describe('buildSendHttpRequest', () => {
  it('maps POST body from SEND apiField keys', () => {
    const built = buildSendHttpRequest({
      endpointUrl: 'https://api.example.com/book',
      method: 'POST',
      sendEntries: [entry('n', 'N'), entry('startDate', 'startDate')],
      rowInputs: { n: '3', startDate: '2026-01-01' },
    });
    expect(built.method).toBe('POST');
    expect(built.url).toBe('https://api.example.com/book');
    expect(built.bodyJson).toBeTruthy();
    const body = JSON.parse(built.bodyJson!);
    expect(body.N).toBe(3);
    expect(body.startDate).toBe('2026-01-01');
  });

  it('puts GET params in query string', () => {
    const built = buildSendHttpRequest({
      endpointUrl: 'https://api.example.com/s',
      method: 'GET',
      sendEntries: [entry('q', 'q')],
      rowInputs: { q: 'hello' },
    });
    expect(built.bodyJson).toBeNull();
    expect(built.url).toContain('q=hello');
  });

  it('substitutes path placeholders and excludes from body', () => {
    const built = buildSendHttpRequest({
      endpointUrl: 'https://api.example.com/items/{id}/sub',
      method: 'POST',
      sendEntries: [entry('id', 'id'), entry('name', 'name')],
      rowInputs: { id: '42', name: 'A' },
    });
    expect(built.url).toContain('42');
    const body = JSON.parse(built.bodyJson!);
    expect(body).toEqual({ name: 'A' });
  });
});
