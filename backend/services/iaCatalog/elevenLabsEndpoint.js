/**
 * Risolve la base URL REST ElevenLabs (globale vs EU/IN data residency) da variabile d'ambiente.
 */

const DEFAULT_GLOBAL_BASE = 'https://api.elevenlabs.io/v1';

function getElevenLabsBaseUrl() {
  const raw = process.env.ELEVENLABS_API_BASE;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '');
  }
  return DEFAULT_GLOBAL_BASE;
}

function isResidencyHost(url) {
  return typeof url === 'string' && url.includes('residency.elevenlabs.io');
}

/** Euristica: chiavi residency ElevenLabs spesso contengono segmenti `_residency_` nel nome. */
function keyLooksResidencyScoped(key) {
  if (typeof key !== 'string' || !key.trim()) return false;
  const k = key.toLowerCase();
  return k.includes('_residency_') || k.includes('residency_eu') || k.includes('residency_in');
}

/**
 * Log all'avvio: avvisa se combinazione chiave vs endpoint è incoerente (401 mismatch da API globale/residency).
 */
function logElevenLabsEndpointConfig() {
  const elevenBase = getElevenLabsBaseUrl();
  const key =
    typeof process.env.ELEVENLABS_API_KEY === 'string' ? process.env.ELEVENLABS_API_KEY.trim() : '';

  console.log('[iaCatalog:elevenlabs]', {
    baseUrl: elevenBase,
    keyResidency: key.includes('residency'),
    endpointResidency: elevenBase.includes('residency'),
    residencyMismatch: Boolean(key && key.includes('residency') && !elevenBase.includes('residency')),
  });

  const baseUrl = elevenBase;
  const keyResidency = Boolean(key && keyLooksResidencyScoped(key));
  const endpointResidency = isResidencyHost(baseUrl);

  const payload = {
    keyResidency,
    endpointResidency,
    baseUrl,
    defaultGlobal: DEFAULT_GLOBAL_BASE,
    keyPresent: Boolean(key),
  };

  if (key && keyResidency && !endpointResidency) {
    console.warn(
      '[iaCatalog:elevenlabs]',
      'Mismatch: la chiave sembra residency-specific ma ELEVENLABS_API_BASE è il cluster globale. Imposta es. ELEVENLABS_API_BASE=https://api.eu.residency.elevenlabs.io/v1',
      payload
    );
  } else if (key && !keyResidency && endpointResidency) {
    console.warn(
      '[iaCatalog:elevenlabs]',
      'Mismatch: ELEVENLABS_API_BASE punta a host residency ma la chiave non segue il pattern residency: verifica chiave/host nella console ElevenLabs.',
      payload
    );
  }

  return payload;
}

module.exports = {
  getElevenLabsBaseUrl,
  logElevenLabsEndpointConfig,
  DEFAULT_GLOBAL_BASE,
  isResidencyHost,
  keyLooksResidencyScoped,
};
