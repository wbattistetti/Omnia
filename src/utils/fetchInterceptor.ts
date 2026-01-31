/**
 * Fetch Interceptor
 *
 * Intercepts fetch requests and console errors to suppress 404 errors in console
 * for specific endpoints that are expected to return 404 (e.g., when a resource doesn't exist yet).
 *
 * This maintains REST semantics while reducing console noise.
 *
 * Architecture:
 * - Wraps window.fetch to track requests to silent endpoints
 * - Intercepts console.error to filter 404 messages for those endpoints
 * - Maintains full REST semantics (404 is still returned, just not logged)
 */

const SILENT_404_ENDPOINTS = [
  '/variable-mappings', // Variable mappings may not exist for new projects
];

/**
 * Track active requests to silent endpoints
 */
const activeSilentRequests = new Set<string>();

/**
 * Check if a URL should have silent 404 handling
 */
function shouldSilence404(url: string): boolean {
  return SILENT_404_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

/**
 * Get a unique key for a request
 */
function getRequestKey(url: string): string {
  return url;
}

/**
 * Original fetch function (backed up before wrapping)
 */
const originalFetch = window.fetch;

/**
 * Original console.error (backed up before wrapping)
 */
const originalConsoleError = console.error;

/**
 * Wrapped fetch that tracks requests to silent endpoints
 */
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const shouldSilence = shouldSilence404(url);
  const requestKey = getRequestKey(url);

  // Track this request if it's a silent endpoint
  if (shouldSilence) {
    activeSilentRequests.add(requestKey);
  }

  try {
    const response = await originalFetch(input, init);

    // If it's a 404 for a silent endpoint, mark it for console suppression
    if (shouldSilence && response.status === 404) {
      // Keep the request key active until the error is logged (or timeout)
      setTimeout(() => {
        activeSilentRequests.delete(requestKey);
      }, 100); // Clean up after 100ms
    } else {
      // Remove from tracking if not 404
      activeSilentRequests.delete(requestKey);
    }

    return response;
  } catch (error) {
    // Remove from tracking on error
    activeSilentRequests.delete(requestKey);
    throw error;
  }
} as typeof fetch;

/**
 * Wrapped console.error that filters 404 messages for silent endpoints
 */
console.error = function(...args: any[]): void {
  // Convert all arguments to strings for pattern matching
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg?.toString) return arg.toString();
    if (arg?.url) return arg.url;
    if (arg?.message) return arg.message;
    return JSON.stringify(arg);
  }).join(' ');

  // Check if this is a 404 error for a silent endpoint
  const is404Error = /404|Not Found|Failed to fetch/i.test(message);
  const isSilentEndpoint = SILENT_404_ENDPOINTS.some(endpoint => message.includes(endpoint));

  // Suppress 404 errors for silent endpoints
  if (is404Error && isSilentEndpoint) {
    return; // Silently ignore
  }

  // Otherwise, log normally
  originalConsoleError.apply(console, args);
};

/**
 * Export the original fetch in case it's needed
 */
export { originalFetch };

/**
 * Add an endpoint to the silent 404 list
 */
export function addSilent404Endpoint(endpoint: string): void {
  if (!SILENT_404_ENDPOINTS.includes(endpoint)) {
    SILENT_404_ENDPOINTS.push(endpoint);
  }
}

/**
 * Remove an endpoint from the silent 404 list
 */
export function removeSilent404Endpoint(endpoint: string): void {
  const index = SILENT_404_ENDPOINTS.indexOf(endpoint);
  if (index > -1) {
    SILENT_404_ENDPOINTS.splice(index, 1);
  }
}
