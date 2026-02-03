// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseServiceEventsParams {
  setServiceUnavailable: React.Dispatch<React.SetStateAction<{
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null>>;
}

/**
 * Hook that listens for service unavailable events.
 */
export function useServiceEvents(params: UseServiceEventsParams) {
  const { setServiceUnavailable } = params;

  useEffect(() => {
    const handleServiceUnavailable = (event: CustomEvent) => {
      const { service, message, endpoint, onRetry } = event.detail || {};
      setServiceUnavailable({ service, message, endpoint, onRetry });
    };

    window.addEventListener('service:unavailable' as any, handleServiceUnavailable);
    return () => {
      window.removeEventListener('service:unavailable' as any, handleServiceUnavailable);
    };
  }, [setServiceUnavailable]);
}
