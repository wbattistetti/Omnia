// Simple delay script for starting FastAPI after Express (ES Modules)
import { spawn } from 'child_process';

const DELAY_SECONDS = 5;

console.log(`[Delay] Waiting ${DELAY_SECONDS} seconds before starting FastAPI...`);

setTimeout(() => {
    console.log('[Delay] Starting FastAPI now...');

    // Start FastAPI using npm run
    const fastapi = spawn('npm', ['run', 'be:apiNew'], {
        stdio: 'inherit',
        shell: true
    });

    fastapi.on('close', (code) => {
        console.log(`[Delay] FastAPI exited with code ${code}`);
        process.exit(code);
    });

}, DELAY_SECONDS * 1000);

