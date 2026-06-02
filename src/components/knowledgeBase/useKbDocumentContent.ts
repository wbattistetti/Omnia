/**
 * Loads KB document text from project repository for the reader panel.
 * Falls back to client-side preview (e.g. xlsx → TSV) when the blob is missing or not yet uploaded.
 */

import React from 'react';
import { normalizeKbDocumentText } from '@domain/knowledgeBase/kbDocumentTextNormalize';
import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

export type UseKbDocumentContentOptions = {
  /** Preview from ingest (`markdownSnippet`) or live xlsx parse — used if repository fetch fails. */
  localFallbackText?: string;
};

export type UseKbDocumentContentResult = {
  text: string;
  loading: boolean;
  error: string | null;
  truncated: boolean;
  totalChars: number;
  reload: () => void;
};

const REPO_UNAVAILABLE_RE =
  /document_not_found|documento kb non trovato|lettura documento fallita \(404\)/i;

function isRepositoryUnavailableError(message: string): boolean {
  return REPO_UNAVAILABLE_RE.test(message.trim());
}

function applyLocalFallback(
  fallback: string,
  setText: (t: string) => void,
  setError: (e: string | null) => void,
  setTotalChars: (n: number) => void
): boolean {
  const local = normalizeKbDocumentText(fallback).trim();
  if (!local) return false;
  setText(local);
  setTotalChars(local.length);
  setError(null);
  return true;
}

export function useKbDocumentContent(
  projectId: string | undefined,
  repositoryDocumentId: string | undefined,
  options: UseKbDocumentContentOptions = {}
): UseKbDocumentContentResult {
  const localFallbackText = normalizeKbDocumentText(String(options.localFallbackText ?? '')).trim();
  const [text, setText] = React.useState(() => localFallbackText);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [truncated, setTruncated] = React.useState(false);
  const [totalChars, setTotalChars] = React.useState(() => localFallbackText.length);
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useLayoutEffect(() => {
    if (localFallbackText) {
      setText(localFallbackText);
      setTotalChars(localFallbackText.length);
    } else {
      setText('');
      setTotalChars(0);
    }
    setError(null);
    setTruncated(false);
    const willFetch = Boolean(projectId?.trim() && repositoryDocumentId?.trim());
    setLoading(willFetch);
  }, [projectId, repositoryDocumentId, localFallbackText]);

  React.useEffect(() => {
    const pid = String(projectId || '').trim();
    const rid = String(repositoryDocumentId || '').trim();
    if (!pid || !rid) {
      setLoading(false);
      applyLocalFallback(localFallbackText, setText, setError, setTotalChars);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchKbDocumentContent(pid, rid)
      .then((res) => {
        if (cancelled) return;
        const remote = String(res.text ?? '').trim();
        if (remote) {
          const normalized = normalizeKbDocumentText(res.text || '');
          setText(normalized);
          setTruncated(res.truncated);
          setTotalChars(res.totalChars || normalized.length);
          setError(null);
          return;
        }
        if (applyLocalFallback(localFallbackText, setText, setError, setTotalChars)) {
          setTruncated(false);
          return;
        }
        setText('');
        setTruncated(res.truncated);
        setTotalChars(res.totalChars);
        if (res.message) {
          setError(res.message);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        if (
          applyLocalFallback(localFallbackText, setText, setError, setTotalChars) &&
          isRepositoryUnavailableError(message)
        ) {
          setTruncated(false);
          return;
        }
        setError(message);
        if (!localFallbackText.trim()) {
          setText('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, repositoryDocumentId, localFallbackText, tick]);

  return { text, loading, error, truncated, totalChars, reload };
}
