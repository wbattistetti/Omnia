/**
 * Loads KB document text from project repository for the reader panel.
 */

import React from 'react';
import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

export type UseKbDocumentContentResult = {
  text: string;
  loading: boolean;
  error: string | null;
  truncated: boolean;
  totalChars: number;
  reload: () => void;
};

export function useKbDocumentContent(
  projectId: string | undefined,
  repositoryDocumentId: string | undefined
): UseKbDocumentContentResult {
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [totalChars, setTotalChars] = React.useState(0);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useLayoutEffect(() => {
    setText('');
    setError(null);
    setTruncated(false);
    setTotalChars(0);
    setLoading(Boolean(projectId?.trim() && repositoryDocumentId?.trim()));
  }, [projectId, repositoryDocumentId]);

  React.useEffect(() => {
    const pid = String(projectId || '').trim();
    const rid = String(repositoryDocumentId || '').trim();
    if (!pid || !rid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKbDocumentContent(pid, rid)
      .then((res) => {
        if (cancelled) return;
        setText(res.text || '');
        setTruncated(res.truncated);
        setTotalChars(res.totalChars);
        if (!res.text?.trim() && res.message) {
          setError(res.message);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setText('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, repositoryDocumentId, tick]);

  return { text, loading, error, truncated, totalChars, reload };
}
