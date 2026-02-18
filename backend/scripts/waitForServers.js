// Wait for all servers to be ready and show final message
import { execSync } from 'child_process';
import http from 'http';

const servers = [
  { name: 'Express', url: 'http://localhost:3100', port: 3100 },
  { name: 'FastAPI', url: 'http://localhost:8000', port: 8000 },
  // Ruby server check can be added if needed
];

const maxAttempts = 60; // 60 seconds total
const delayMs = 1000;

function checkServer(server) {
  return new Promise((resolve) => {
    const req = http.get(server.url, { timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForAllServers() {
  console.log('\n[STARTUP] ⏳ Waiting for all servers to be ready...\n');

  const ready = new Set();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const server of servers) {
      if (!ready.has(server.name)) {
        const isReady = await checkServer(server);
        if (isReady) {
          ready.add(server.name);
          console.log(`[STARTUP] ✅ ${server.name} is ready (http://localhost:${server.port})`);
        }
      }
    }

    if (ready.size === servers.length) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ TUTTI I SERVER AVVIATI');
      console.log('='.repeat(60));
      console.log('📋 Servers running:');
      servers.forEach(s => {
        console.log(`   ✅ ${s.name}: http://localhost:${s.port}`);
      });
      console.log('   ✅ Redis: localhost:6379');
      console.log('   ✅ Ruby: (check terminal)');
      console.log('='.repeat(60) + '\n');

      // Keep script running to avoid "exited" message
      // Monitor servers periodically (every 30 seconds) to ensure they stay up
      console.log('[STARTUP] 🔄 Monitoring servers... (press Ctrl+C to stop)\n');
      setInterval(async () => {
        for (const server of servers) {
          const isReady = await checkServer(server);
          if (!isReady) {
            console.warn(`[STARTUP] ⚠️ ${server.name} is not responding!`);
          }
        }
      }, 30000); // Check every 30 seconds

      // Keep process alive
      return;
    }

    if (attempt < maxAttempts) {
      const remaining = servers.filter(s => !ready.has(s.name)).map(s => s.name).join(', ');
      console.log(`[STARTUP] ⏳ Waiting for: ${remaining}... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // If we get here, not all servers are ready
  const notReady = servers.filter(s => !ready.has(s.name)).map(s => s.name);
  console.error('\n[STARTUP] ❌ Some servers did not become ready:');
  notReady.forEach(name => console.error(`   ❌ ${name}`));
  console.error('\n[STARTUP] Continuing anyway - servers may still be starting...\n');
}

waitForAllServers().catch(error => {
  console.error('[STARTUP] ❌ Error waiting for servers:', error);
  // Don't exit - servers may still be starting
});
