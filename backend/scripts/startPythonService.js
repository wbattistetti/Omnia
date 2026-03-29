const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PYTHON_PORT = 8000;
const PYTHON_SERVICE_URL = `http://localhost:${PYTHON_PORT}`;
const HEALTH_CHECK_ENDPOINT = '/api/ping';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

/**
 * Verifica se il servizio Python è disponibile
 */
async function checkServiceHealth() {
  return new Promise((resolve, reject) => {
    const fullUrl = `${PYTHON_SERVICE_URL}${HEALTH_CHECK_ENDPOINT}`;
    const req = http.get(fullUrl, {
      timeout: 3000,
      headers: {
        'User-Agent': 'PythonServiceHealthCheck/1.0'
      }
    }, (res) => {
      // Verifica status code
      if (res.statusCode !== 200) {
        reject(new Error(`Health check returned status ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (!data || data.trim() === '') {
            reject(new Error('Health check returned empty response'));
            return;
          }
          const json = JSON.parse(data);
          if (json.ok === true) {
            resolve(true);
          } else {
            reject(new Error(`Health check returned unexpected response: ${JSON.stringify(json)}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse health check response: ${err.message}. Raw response: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (err) => {
      // Migliora il messaggio di errore per errori di connessione
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Connection refused - service may not be ready yet'));
      } else if (err.code === 'ETIMEDOUT') {
        reject(new Error('Connection timeout'));
      } else if (err.code === 'ENOTFOUND') {
        reject(new Error('Host not found'));
      } else {
        reject(new Error(`Connection error: ${err.code || err.message || 'Unknown error'}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout (3s)'));
    });

    // Timeout di sicurezza
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Attende che il servizio Python sia disponibile con retry
 */
async function waitForService(maxRetries = MAX_RETRIES, delay = RETRY_DELAY) {
  console.log(`[Python Service] 🔍 Waiting for service to be available at ${PYTHON_SERVICE_URL}...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await checkServiceHealth();
      console.log(`[Python Service] ✅ Service is available after ${attempt} attempt(s)`);
      return true;
    } catch (err) {
      if (attempt < maxRetries) {
        // Mostra il messaggio di errore solo ogni 5 tentativi per non intasare i log
        if (attempt % 5 === 0 || attempt <= 3) {
          process.stdout.write(`[Python Service] ⏳ Attempt ${attempt}/${maxRetries}... (${err.message})\r`);
        } else {
          process.stdout.write(`[Python Service] ⏳ Attempt ${attempt}/${maxRetries}...\r`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`\n[Python Service] ❌ Service failed to start after ${maxRetries} attempts`);
        console.error(`[Python Service] Last error: ${err.message || 'Unknown error'}`);
        console.error(`[Python Service] 💡 Troubleshooting:`);
        console.error(`[Python Service]   1. Check if uvicorn is installed: pip install uvicorn[standard]`);
        console.error(`[Python Service]   2. Check if the service is actually running on port ${PYTHON_PORT}`);
        console.error(`[Python Service]   3. Try accessing http://localhost:${PYTHON_PORT}/api/ping manually`);
        console.error(`[Python Service]   4. Check Python/FastAPI logs for errors`);
        return false;
      }
    }
  }
  return false;
}

/**
 * Verifica se la porta Python è già in uso
 */
async function checkPortInUse() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(PYTHON_PORT, '127.0.0.1', () => {
      server.close(() => resolve(false)); // Porta libera
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Porta già in uso
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * PIDs with TCP LISTENING on the given port (Windows: netstat; Unix: lsof).
 */
function getListeningPids(port) {
  const isWindows = process.platform === 'win32';
  const pids = new Set();

  if (isWindows) {
    try {
      const out = execSync('netstat -ano', { encoding: 'utf8', maxBuffer: 1024 * 1024 });
      const portToken = `:${port}`;
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(portToken) || !/LISTENING/i.test(line)) continue;
        const m = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
        if (m) pids.add(m[1]);
      }
    } catch {
      /* ignore */
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -i :${port} -t -sTCP:LISTEN`, { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      const t = line.trim();
      if (/^\d+$/.test(t)) pids.add(t);
    }
  } catch {
    /* ignore */
  }
  return [...pids];
}

/**
 * Kill processes listening on port (e.g. stale uvicorn). Skips current PID.
 * @returns {number} number of kill attempts made
 */
function killListenersOnPort(port) {
  const raw = getListeningPids(port).filter((p) => String(p) !== String(process.pid));
  let attempts = 0;
  const isWindows = process.platform === 'win32';

  for (const pid of raw) {
    attempts += 1;
    try {
      if (isWindows) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
      } else {
        process.kill(parseInt(pid, 10), 'SIGKILL');
      }
      console.log(`[Python Service] 🔪 Sent kill to PID ${pid}`);
    } catch (err) {
      console.warn(`[Python Service] ⚠️ Could not kill PID ${pid}: ${err.message || err}`);
    }
  }
  return attempts;
}

/**
 * Avvia il servizio Python
 */
async function startPythonService() {
  console.log('[Python Service] 🚀 Starting Python FastAPI service...');
  console.log(
    `[Python Service] Command: uvicorn newBackend.app:app --host 127.0.0.1 --port ${PYTHON_PORT} --reload`
  );

  // Verifica se la porta è già in uso
  let portInUse = await checkPortInUse();
  if (portInUse) {
    console.log(`[Python Service] ⚠️  Port ${PYTHON_PORT} is already in use`);
    console.log('[Python Service] 🔍 Checking if existing service is healthy...');

    const isHealthy = await checkServiceHealth().catch(() => false);
    if (isHealthy) {
      console.log('[Python Service] ✅ Service is already running and healthy');
      return true;
    }

    if (process.env.PYTHON_SERVICE_NO_KILL === '1') {
      console.error(`[Python Service] ❌ Port ${PYTHON_PORT} is in use but service is not responding`);
      console.error(
        '[Python Service] 💡 Stop the process manually or unset PYTHON_SERVICE_NO_KILL to allow auto-kill'
      );
      process.exit(1);
    }

    console.warn(
      `[Python Service] ⚠️ Stale listener on port ${PYTHON_PORT} (no healthy /api/ping). Trying to free the port...`
    );
    const killed = killListenersOnPort(PYTHON_PORT);
    if (killed === 0) {
      console.error(`[Python Service] ❌ Could not find a LISTENING PID for port ${PYTHON_PORT}`);
      console.error(
        `[Python Service] 💡 Run as admin or stop the process manually (e.g. netstat -ano | findstr :${PYTHON_PORT})`
      );
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 1500));
    portInUse = await checkPortInUse();
    if (portInUse) {
      const healthyAfter = await checkServiceHealth().catch(() => false);
      if (healthyAfter) {
        console.log('[Python Service] ✅ Service is now healthy after freeing the port');
        return true;
      }
      console.error(`[Python Service] ❌ Port ${PYTHON_PORT} still in use after kill attempt`);
      process.exit(1);
    }
    console.log(`[Python Service] ✅ Port ${PYTHON_PORT} is free; starting uvicorn...`);
  }

  // Determina se siamo su Windows o Unix
  const isWindows = process.platform === 'win32';

  // ✅ USA IL VIRTUALENV se esiste, altrimenti usa uvicorn direttamente
  const venvPython = isWindows
    ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    : path.join(process.cwd(), '.venv', 'bin', 'python');

  let pythonCommand, pythonArgs;

  if (fs.existsSync(venvPython)) {
    // Usa il virtualenv se esiste (ha numpy e sentence-transformers)
    console.log('[Python Service] ✅ Using virtualenv:', venvPython);
    pythonCommand = venvPython;
    pythonArgs = [
      '-m', 'uvicorn',
      'newBackend.app:app',
      '--host', '127.0.0.1',
      '--port', String(PYTHON_PORT),
      '--reload'
    ];
  } else {
    // Fallback: usa uvicorn direttamente (comportamento originale)
    console.log('[Python Service] ⚠️  Virtualenv not found, using system Python');
    pythonCommand = 'uvicorn';
    pythonArgs = [
      'newBackend.app:app',
      '--host', '127.0.0.1',
      '--port', String(PYTHON_PORT),
      '--reload'
    ];
  }

  // Avvia uvicorn
  const pythonProcess = spawn(pythonCommand, pythonArgs, {
    stdio: 'inherit', // Mostra output direttamente
    shell: isWindows && pythonCommand === 'uvicorn', // Usa shell solo se chiamiamo uvicorn direttamente
    cwd: process.cwd()
  });

  // Gestisci errori di avvio
  pythonProcess.on('error', (err) => {
    console.error('[Python Service] ❌ Failed to start Python service:', err.message);
    if (err.code === 'ENOENT') {
      console.error('[Python Service] 💡 Make sure uvicorn is installed: pip install uvicorn[standard]');
      console.error('[Python Service] 💡 Make sure you are in the project root directory');
      console.error('[Python Service] 💡 On Windows, make sure Python is in your PATH');
    }
    process.exit(1);
  });

  // Attendi che il processo sia avviato (uvicorn con --reload avvia prima un reloader)
  // Serve più tempo per permettere al reloader di avviare il processo principale
  // Uvicorn con --reload: reloader process → main process (può richiedere 8-12 secondi)
  console.log('[Python Service] ⏳ Waiting for uvicorn reloader to start main process...');
  console.log('[Python Service] ℹ️  Note: With --reload, uvicorn starts a reloader process first, then the main process');
  console.log('[Python Service] ℹ️  This can take 8-12 seconds. Please wait...');

  // Attendi 10 secondi per permettere al reloader di avviare completamente il processo principale
  // Aumentato da 6 a 10 secondi per gestire meglio i casi con dipendenze pesanti
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Verifica che il processo sia ancora in esecuzione
  if (pythonProcess.killed) {
    console.error('[Python Service] ❌ Python process exited immediately');
    process.exit(1);
  }

  // Attendi che il servizio sia disponibile
  const isAvailable = await waitForService();

  if (!isAvailable) {
    console.error('[Python Service] ❌ Service failed to become available');
    pythonProcess.kill();
    process.exit(1);
  }

  console.log('[Python Service] ✅ Python FastAPI service is running and healthy');
  console.log(`[Python Service] 🌐 Service URL: ${PYTHON_SERVICE_URL}`);
  console.log(`[Python Service] 📊 Health check: ${PYTHON_SERVICE_URL}${HEALTH_CHECK_ENDPOINT}`);

  // Gestisci terminazione del processo
  pythonProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[Python Service] ❌ Process exited with code ${code}`);
    } else if (signal) {
      console.log(`[Python Service] ℹ️  Process terminated by signal ${signal}`);
    }
  });

  // Mantieni lo script in esecuzione
  process.on('SIGINT', () => {
    console.log('\n[Python Service] 🛑 Shutting down...');
    pythonProcess.kill('SIGTERM');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Python Service] 🛑 Shutting down...');
    pythonProcess.kill('SIGTERM');
    process.exit(0);
  });

  return true;
}

// Avvia il servizio
startPythonService().catch((err) => {
  console.error('[Python Service] ❌ Fatal error:', err);
  process.exit(1);
});
