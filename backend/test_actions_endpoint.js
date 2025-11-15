/**
 * Test script to verify actions are loaded from Task_Templates
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3100';
const ENDPOINT = '/api/factory/task-templates?taskType=Action';

async function testActionsEndpoint() {
    return new Promise((resolve, reject) => {
        const url = `${SERVER_URL}${ENDPOINT}`;
        console.log('[TEST] Testing endpoint:', url);

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const actions = JSON.parse(data);
                        console.log('[TEST] ✅ Success! Status:', res.statusCode);
                        console.log(`[TEST] Actions loaded: ${actions.length}`);

                        if (actions.length > 0) {
                            console.log('\n[TEST] Sample actions:');
                            actions.slice(0, 5).forEach((action, idx) => {
                                console.log(`  ${idx + 1}. ${action.label || action.id || 'N/A'}`);
                                console.log(`     - taskType: ${action.taskType || 'N/A'}`);
                                console.log(`     - icon: ${action.icon || 'N/A'}`);
                                console.log(`     - Has structure: ${action.structure ? 'YES' : 'NO'}`);
                            });
                        } else {
                            console.log('[TEST] ⚠️  No actions found! Check if Actions were migrated to Task_Templates.');
                        }

                        resolve(true);
                    } catch (e) {
                        console.error('[TEST] ❌ Failed to parse JSON response:', e);
                        reject(e);
                    }
                } else {
                    console.error(`[TEST] ❌ Failed with status: ${res.statusCode}`);
                    console.error('[TEST] Response:', data);
                    reject(new Error(`Server responded with status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            console.error('[TEST] ❌ Error making request:', err.message);
            console.error('[TEST] Make sure the server is running on port 3100');
            reject(err);
        });
    });
}

if (require.main === module) {
    testActionsEndpoint()
        .then(() => {
            console.log('\n[TEST] ✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[TEST] ❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testActionsEndpoint };

