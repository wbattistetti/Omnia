/**
 * Utility per verificare se TaskTemplatesV2 è attivo e funzionante
 *
 * Usa questo per debug e verifica:
 *
 * import { checkTaskTemplatesV2 } from './utils/checkTaskTemplatesV2';
 * checkTaskTemplatesV2();
 */

export async function checkTaskTemplatesV2(): Promise<{
  isEnabled: boolean;
  backendReachable: boolean;
  templatesCount: number;
  error?: string;
}> {
  const result = {
    isEnabled: false,
    backendReachable: false,
    templatesCount: 0,
    error: undefined as string | undefined
  };

  try {
    // 1. Verifica feature flag
    const featureFlag = localStorage.getItem('USE_TASK_TEMPLATES_V2') === 'true';
    result.isEnabled = featureFlag;

    if (!featureFlag) {
      result.error = 'Feature flag not enabled. Set localStorage.setItem("USE_TASK_TEMPLATES_V2", "true")';
      return result;
    }

    // 2. Usa path relativo per sfruttare il proxy Vite
    // Il proxy in vite.config.ts inoltra /api/factory a http://localhost:3100 (Express)
    // Gli endpoint /api/factory sono sempre gestiti da Express, anche se il runtime è VB.NET
    const testUrl = `/api/factory/tasks?scopes=general`;

    console.log('[checkTaskTemplatesV2] Testing endpoint:', testUrl);
    console.log('[checkTaskTemplatesV2] Full URL (via Vite proxy):', window.location.origin + testUrl);

    const res = await fetch(testUrl);

    if (!res.ok) {
      result.error = `HTTP ${res.status}: ${res.statusText}`;
      return result;
    }

    result.backendReachable = true;
    const templates = await res.json();
    result.templatesCount = Array.isArray(templates) ? templates.length : 0;

    console.log('[checkTaskTemplatesV2] ✅ Success!', result);

    return result;

  } catch (error: any) {
    result.error = error.message || String(error);
    console.error('[checkTaskTemplatesV2] ❌ Error:', error);
    return result;
  }
}

/**
 * Mostra un report completo nello stato del sistema
 */
export async function showTaskTemplatesV2Status(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 TASK TEMPLATES V2 STATUS REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════');

  const status = await checkTaskTemplatesV2();

  console.log('Feature Flag:', status.isEnabled ? '✅ ENABLED' : '❌ DISABLED');
  console.log('Backend Reachable:', status.backendReachable ? '✅ YES' : '❌ NO');
  console.log('Templates Found:', status.templatesCount);

  if (status.error) {
    console.error('Error:', status.error);
  }

  if (status.isEnabled && status.backendReachable && status.templatesCount > 0) {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ NUOVO SISTEMA ATTIVO E FUNZIONANTE!');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  } else {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('⚠️ NUOVO SISTEMA NON ATTIVO O NON FUNZIONANTE');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }
}

// Auto-esporta in window per accesso da console
if (typeof window !== 'undefined') {
  (window as any).checkTaskTemplatesV2 = checkTaskTemplatesV2;
  (window as any).showTaskTemplatesV2Status = showTaskTemplatesV2Status;
}

