/**
 * Normalized shapes for IA runtime provisioning failures (any cloud provider).
 */

export interface NormalizedIaProviderError {
  provider: string;
  code: string;
  message: string;
  raw?: unknown;
}

export interface ProviderErrorAdapter {
  provider: string;
  canHandle(error: unknown): boolean;
  normalize(error: unknown): NormalizedIaProviderError;
  inferFixAction?(normalized: NormalizedIaProviderError): string;
}
