/**
 * Single extraction engine: VB.NET ParserExtraction via POST /api/nlp/contract-extract.
 * Proxied to ApiServer (port 5000) in vite.config.ts.
 */

import type { NLPContract } from '../components/DialogueDataEngine/contracts/contractLoader';

export interface VbContractExtractResult {
  values: Record<string, unknown>;
  hasMatch: boolean;
  engine: string;
}

export async function extractWithVbContract(
  text: string,
  contract: NLPContract,
  composite: boolean
): Promise<VbContractExtractResult> {
  const trimmed = String(text || '').trim();
  const res = await fetch('/api/nlp/contract-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: trimmed,
      contractJson: JSON.stringify(contract),
      composite,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string; error?: string }).detail ||
        (err as { error?: string }).error ||
        `contract-extract failed: ${res.status}`
    );
  }

  const data = (await res.json()) as VbContractExtractResult;
  return {
    values: data.values && typeof data.values === 'object' ? data.values : {},
    hasMatch: Boolean(data.hasMatch),
    engine: data.engine || 'vb',
  };
}
