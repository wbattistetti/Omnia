// Wait for Redis to be ready
import { execSync } from 'child_process';

const maxAttempts = 30;
const delayMs = 1000;

async function waitForRedis() {
  console.log('[Redis] ⏳ Waiting for Redis to be ready...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync('docker exec redis redis-cli ping', {
        stdio: 'ignore',
        timeout: 2000
      });
      console.log('[Redis] ✅ Redis is ready');
      return;
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`[Redis] ⏳ Waiting for Redis... (${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('[Redis] ❌ Redis did not become ready after 30 seconds');
        console.error('[Redis] Make sure Docker is running and Redis container is started');
        console.error('[Redis] Try: docker-compose up -d redis');
        process.exit(1);
      }
    }
  }
}

waitForRedis().catch(error => {
  console.error('[Redis] ❌ Error waiting for Redis:', error);
  process.exit(1);
});
