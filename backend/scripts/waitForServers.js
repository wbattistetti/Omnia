// Wait for all servers to be ready and show final message
import { execSync } from 'child_process';
import http from 'http';

const servers = [
  {
    name: 'Express',
    url: 'http://localhost:3100',
    healthCheck: 'http://localhost:3100/api/health/redis', // Usa endpoint specifico
    port: 3100
  },
  {
    name: 'FastAPI',
    url: 'http://localhost:8000',
    healthCheck: 'http://localhost:8000/api/ping', // Usa /api/ping come startPythonService.js
    port: 8000
  },
  {
    name: 'Ruby',
    url: 'http://localhost:3101',
    healthCheck: 'http://localhost:3101/', // Ruby ha endpoint root che ritorna JSON
    port: 3101
  },
];

const maxAttempts = 60; // 60 seconds total
const delayMs = 1000;

function checkServer(server) {
  return new Promise((resolve) => {
    // Usa healthCheck endpoint se disponibile, altrimenti URL base
    const checkUrl = server.healthCheck || server.url;

    const req = http.get(checkUrl, { timeout: 3000 }, (res) => {
      // Per FastAPI, verifica che la risposta sia JSON valido con ok: true
      if (server.name === 'FastAPI') {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.ok === true);
          } catch {
            resolve(false);
          }
        });
      } else if (server.name === 'Ruby') {
        // Ruby ritorna JSON con status: 'ok' alla root
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.status === 'ok');
          } catch {
            resolve(false);
          }
        });
      } else {
        // Express: qualsiasi risposta HTTP valida va bene
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
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
      console.log('='.repeat(60) + '\n');

      // Keep script running to avoid "exited" message
      // Monitor servers periodically (every 30 seconds) to ensure they stay up
      console.log('[STARTUP] 🔄 Monitoring servers... (press Ctrl+C to stop)\n');
      setInterval(async () => {
        for (const server of servers) {
          const isReady = await checkServer(server);
          if (!isReady) {
            console.warn(`[STARTUP] ⚠️ ${server.name} is not responding! (${server.healthCheck || server.url})`);
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
