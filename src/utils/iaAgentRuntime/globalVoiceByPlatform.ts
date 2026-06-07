/**
 * Voci di default GLOBALI per piattaforma agente IA.
 *
 * Modello: una voce TTS preferita per ogni `IAAgentPlatform` (`elevenlabs`, `openai`,
 * `anthropic`, `google`). Persistito in `localStorage` come mappa `platform -> IAAgentVoiceConfig`.
 *
 * Razionale dell'introduzione:
 *   - L'esistente {@link loadGlobalIaAgentConfig} salva UN SOLO {@link IAAgentConfig} (e quindi
 *     UNA sola voce: quella della piattaforma corrente). Per il dropdown «Deploy» del wizard
 *     serve invece un'ANTEPRIMA delle voci preferite per OGNI piattaforma, anche per quelle
 *     non attualmente selezionate, senza dover cambiare la `platform` globale.
 *   - Backward-compat: se la mappa non contiene una entry per la piattaforma X, la voce ricade
 *     sull'eventuale `voice` del global config (quando la piattaforma corrente coincide). Quindi
 *     la mappa estende, non sostituisce, lo stato esistente.
 *
 * Use case principali:
 *   - Lettura: dropdown «Deploy» del wizard mostra «<Platform> — <voce>» o «Manca la voce – Fix».
 *   - Scrittura: quando l'utente conferma una voce nel pannello Settings > IA Runtime per
 *     piattaforma X, salviamo la voce anche qui (vedi orchestrazione esterna).
 *
 * NOTA: questo modulo non gestisce la concorrenza fra schede browser (storage event). Se
 * servisse, andrebbe esposto un subscribe pattern. Per ora non necessario.
 */

import type { IAAgentPlatform, IAAgentVoiceConfig } from 'types/iaAgentRuntimeSetup';

const STORAGE_KEY = 'omnia.globalVoiceByPlatform.v1';

/** Tutte le piattaforme su cui può vivere un AI Agent. Allineato a {@link IAAgentPlatform}. */
export const SUPPORTED_AGENT_PLATFORMS: readonly IAAgentPlatform[] = [
  'anthropic',
  'elevenlabs',
  'google',
  'openai',
] as const;

/**
 * Etichetta UI per piattaforma. `'google'` viene mostrato come `Gemini` (label commerciale),
 * coerente col resto della UI che parla di Gemini, non Google.
 */
export const AGENT_PLATFORM_DISPLAY_LABEL: Readonly<Record<IAAgentPlatform, string>> = {
  anthropic: 'Anthropic',
  elevenlabs: 'ElevenLabs',
  google: 'Gemini',
  openai: 'OpenAI',
  custom: 'Custom',
};

export type GlobalVoiceByPlatformMap = Partial<Record<IAAgentPlatform, IAAgentVoiceConfig>>;

function isVoiceConfig(value: unknown): value is IAAgentVoiceConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<IAAgentVoiceConfig>;
  return typeof v.id === 'string' && v.id.length > 0 && typeof v.language === 'string';
}

function isAgentPlatform(value: unknown): value is IAAgentPlatform {
  return (
    value === 'elevenlabs' ||
    value === 'openai' ||
    value === 'anthropic' ||
    value === 'google' ||
    value === 'custom'
  );
}

/**
 * Carica la mappa platform -> voce. Tollerante: ignora chiavi sconosciute e voci malformate.
 * Mai throw: in caso di errore localStorage / JSON ritorna mappa vuota.
 */
export function loadGlobalVoiceByPlatform(): GlobalVoiceByPlatformMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: GlobalVoiceByPlatformMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isAgentPlatform(k)) continue;
      if (!isVoiceConfig(v)) continue;
      out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Restituisce la voce di default GLOBALE per una piattaforma, se presente. `null` se non
 * configurata (l'UI mostra «Manca la voce – Fix»). Non fa fallback su altre piattaforme:
 * la voce è semanticamente legata alla piattaforma di destinazione (lingue/timbri diversi).
 */
export function getGlobalVoiceFor(platform: IAAgentPlatform): IAAgentVoiceConfig | null {
  const map = loadGlobalVoiceByPlatform();
  const voice = map[platform];
  return voice ?? null;
}

/**
 * Imposta/aggiorna la voce di default GLOBALE per una piattaforma. Passare `null` rimuove
 * l'entry (equivale a «non configurata»). Throw esplicito se la persistenza fallisce
 * (regola progetto: fail-loud, no silent swallow).
 */
export function saveGlobalVoiceForPlatform(
  platform: IAAgentPlatform,
  voice: IAAgentVoiceConfig | null
): void {
  const current = loadGlobalVoiceByPlatform();
  const next: GlobalVoiceByPlatformMap = { ...current };
  if (voice === null) {
    delete next[platform];
  } else {
    if (!isVoiceConfig(voice)) {
      throw new Error(
        `saveGlobalVoiceForPlatform: voice malformata per platform=${platform} (id e language obbligatori)`
      );
    }
    next[platform] = voice;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    throw new Error(
      `saveGlobalVoiceForPlatform: persistenza fallita: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Risolve la voce visualizzata nel dropdown «Deploy» per una specifica `platform`,
 * applicando la regola di priorità definita dal designer:
 *
 *   1. se la **configurazione GENERALE** (`globalMap`) ha una voce per `platform`, usa quella;
 *   2. altrimenti, se l'**override del task editor** è impostato sulla **stessa** `platform`
 *      e contiene una `voice` valida, usa quella (è l'unica platform "raggiungibile"
 *      dall'override del task, perché l'override ha sempre una sola `platform` alla volta);
 *   3. altrimenti `null` → la UI mostra «Manca la voce – Fix».
 *
 * Pure function: nessun side-effect, nessun accesso a `localStorage`. Il caller passa
 * la mappa già caricata e (opzionalmente) lo snapshot dell'override task.
 *
 * @param platform Piattaforma di destinazione.
 * @param globalMap Mappa platform → voce caricata da {@link loadGlobalVoiceByPlatform}.
 * @param taskOverride Snapshot opzionale dell'override IA del task corrente
 *                     (almeno `platform` e `voice`). Se assente o non coincide con
 *                     `platform`, il fallback (2) è inattivo.
 */
export function resolveVoiceForPlatform(
  platform: IAAgentPlatform,
  globalMap: GlobalVoiceByPlatformMap,
  taskOverride?: { platform?: IAAgentPlatform | null; voice?: IAAgentVoiceConfig | null } | null
): IAAgentVoiceConfig | null {
  const fromGlobal = globalMap[platform];
  if (fromGlobal && isVoiceConfig(fromGlobal)) return fromGlobal;
  if (taskOverride && taskOverride.platform === platform && taskOverride.voice && isVoiceConfig(taskOverride.voice)) {
    return taskOverride.voice;
  }
  return null;
}

/**
 * Versione "batch" di {@link resolveVoiceForPlatform}: ritorna una mappa risolta per tutte
 * le `SUPPORTED_AGENT_PLATFORMS` (escluse quelle non risolvibili). Comodo per il deploy menu
 * che mostra una riga per ogni piattaforma.
 */
export function resolveVoicesByPlatform(
  globalMap: GlobalVoiceByPlatformMap,
  taskOverride?: { platform?: IAAgentPlatform | null; voice?: IAAgentVoiceConfig | null } | null
): GlobalVoiceByPlatformMap {
  const out: GlobalVoiceByPlatformMap = {};
  for (const platform of SUPPORTED_AGENT_PLATFORMS) {
    const v = resolveVoiceForPlatform(platform, globalMap, taskOverride);
    if (v) out[platform] = v;
  }
  return out;
}

/**
 * Etichetta umana di una voce per la UI del dropdown. Strategia:
 *   - se {@link IAAgentVoiceConfig.settings.name} (quando il caller ce l'ha messa) è presente
 *     e non vuota, usa quella (es. «Simon»);
 *   - altrimenti usa l'`id` (di solito l'id ElevenLabs / OpenAI è già parlante o almeno
 *     riconoscibile per il designer che l'ha scelto).
 *
 * Pure function, no DOM, no localStorage: testabile in isolamento.
 */
export function describeVoice(voice: IAAgentVoiceConfig): string {
  const settings = voice.settings;
  if (settings && typeof settings === 'object') {
    const name = (settings as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  return voice.id;
}

/**
 * Etichetta voce per menu Deploy: solo nome umano, mai l'id tecnico ElevenLabs/OpenAI.
 */
export function describeVoiceForDeployMenu(voice: IAAgentVoiceConfig): string | null {
  const settings = voice.settings;
  if (settings && typeof settings === 'object') {
    const name = (settings as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }
  }
  return null;
}
