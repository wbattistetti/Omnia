import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKbDocumentContent } from '../useKbDocumentContent';

vi.mock('@services/kbDocumentRepositoryApi', () => ({
  fetchKbDocumentContent: vi.fn(),
}));

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

describe('useKbDocumentContent', () => {
  beforeEach(() => {
    vi.mocked(fetchKbDocumentContent).mockReset();
  });

  it('uses local fallback when repository returns document_not_found', async () => {
    vi.mocked(fetchKbDocumentContent).mockRejectedValue(new Error('document_not_found'));

    const { result } = renderHook(() =>
      useKbDocumentContent('proj-1', 'doc-1', {
        localFallbackText: 'cognome\tnome\nRossi\tMario',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.text).toContain('cognome');
    expect(result.current.text).toContain('Rossi');
  });

  it('shows repository text when fetch succeeds', async () => {
    vi.mocked(fetchKbDocumentContent).mockResolvedValue({
      success: true,
      meta: {
        id: 'doc-1',
        projectId: 'proj-1',
        name: 'a.csv',
        mimeType: 'text/csv',
        size: 10,
        uploadedAt: '',
      },
      text: 'remote body',
      truncated: false,
      totalChars: 11,
    });

    const { result } = renderHook(() =>
      useKbDocumentContent('proj-1', 'doc-1', {
        localFallbackText: 'local only',
      })
    );

    await waitFor(() => expect(result.current.text).toBe('remote body'));
    expect(result.current.error).toBeNull();
  });
});
