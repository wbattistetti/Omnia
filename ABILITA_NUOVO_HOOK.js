// Copia e incolla questo codice nella Console del Browser (F12)

// 1. Abilita il feature flag
localStorage.setItem('feature.internalRowManager', 'true');

// 2. Verifica che sia stato settato
console.log('✅ Feature flag abilitato:', localStorage.getItem('feature.internalRowManager'));

// 3. Ricarica la pagina
console.log('🔄 Ricarica la pagina per applicare le modifiche...');
location.reload();

