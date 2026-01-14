/**
 * Mostra lo stato del sistema TaskTemplatesV2 all'avvio
 * Viene chiamato automaticamente quando l'app si carica
 */

export function showTaskTemplatesV2StatusOnLoad(): void {
  // Only show in development mode or if explicitly enabled
  const showStatus = import.meta.env.DEV || localStorage.getItem('SHOW_TASK_TEMPLATES_V2_STATUS') === 'true';
  if (!showStatus) {
    return;
  }

  const featureFlag = localStorage.getItem('USE_TASK_TEMPLATES_V2') === 'true';

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 TASK TEMPLATES V2 - STATUS CHECK');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('Feature Flag:', featureFlag ? '✅ ENABLED' : '❌ DISABLED');

  if (featureFlag) {
    console.log('');
    console.log('⭐ NUOVO SISTEMA ATTIVO ⭐');
    console.log('');
    console.log('Il nuovo sistema TaskTemplates sarà utilizzato quando:');
    console.log('  - Apri l\'Intellisense (Ctrl+Space o click sull\'icona)');
    console.log('  - Crei un nuovo progetto');
    console.log('  - Chiami ProjectDataService.loadTaskTemplatesFromFactory()');
    console.log('');
    console.log('Per testare subito, esegui nella console:');
    console.log('  window.testTaskTemplatesV2()');
    console.log('');
  } else {
    console.log('');
    console.log('⚠️ VECCHIO SISTEMA ATTIVO ⚠️');
    console.log('');
    console.log('Per attivare il nuovo sistema, esegui:');
    console.log('  localStorage.setItem("USE_TASK_TEMPLATES_V2", "true");');
    console.log('  location.reload();');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════════════════');
}

/**
 * Testa il nuovo sistema forzando il caricamento
 */
export async function testTaskTemplatesV2(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING TaskTemplatesV2');
  console.log('═══════════════════════════════════════════════════════════════════════════');

  const featureFlag = localStorage.getItem('USE_TASK_TEMPLATES_V2') === 'true';

  if (!featureFlag) {
    console.error('❌ Feature flag non attivo!');
    console.log('Esegui: localStorage.setItem("USE_TASK_TEMPLATES_V2", "true")');
    return;
  }

    try {
      const { ProjectDataService } = await import('../services/ProjectDataService');

      console.log('📡 Chiamando loadTaskTemplatesFromFactory()...');
      await ProjectDataService.loadTaskTemplatesFromFactory();

    console.log('✅ Test completato! Controlla i log sopra per i dettagli.');

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  }

  console.log('═══════════════════════════════════════════════════════════════════════════');
}

// Auto-esporta in window per accesso da console
if (typeof window !== 'undefined') {
  (window as any).showTaskTemplatesV2StatusOnLoad = showTaskTemplatesV2StatusOnLoad;
  (window as any).testTaskTemplatesV2 = testTaskTemplatesV2;

  // Chiama automaticamente all'avvio
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showTaskTemplatesV2StatusOnLoad);
  } else {
    showTaskTemplatesV2StatusOnLoad();
  }
}

