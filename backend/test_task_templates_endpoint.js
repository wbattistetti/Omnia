/**
 * Test the /api/factory/task-templates endpoint with taskType=Action
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3100';
const ENDPOINT = '/api/factory/task-templates?taskType=Action';

function testEndpoint() {
    return new Promise((resolve, reject) => {
        const url = `${SERVER_URL}${ENDPOINT}`;
        console.log('[TEST] Testing:', url);

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        console.log(`[TEST] ✅ Status: ${res.statusCode}`);
                        console.log(`[TEST] Results: ${result.length}`);
                        if (result.length > 0) {
                            console.log(`[TEST] First result:`);
                            console.log(`  - id: ${result[0].id || result[0]._id}`);
                            console.log(`  - taskType: ${result[0].taskType}`);
                            console.log(`  - label: ${result[0].label}`);
                        } else {
                            console.log('[TEST] ⚠️  No results found');
                        }
                        resolve(result);
                    } catch (e) {
                        console.error('[TEST] ❌ Parse error:', e.message);
                        console.error('[TEST] Response:', data.substring(0, 200));
                        reject(e);
                    }
                } else {
                    console.error(`[TEST] ❌ Status: ${res.statusCode}`);
                    console.error('[TEST] Response:', data);
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            console.error('[TEST] ❌ Connection error:', err.message);
            console.error('[TEST] Make sure the server is running on port 3100');
            reject(err);
        });
    });
}

// Also test the /api/factory/actions endpoint
function testActionsEndpoint() {
    return new Promise((resolve, reject) => {
        const url = `${SERVER_URL}/api/factory/actions`;
        console.log('\n[TEST] Testing:', url);

        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        console.log(`[TEST] ✅ Status: ${res.statusCode}`);
                        console.log(`[TEST] Results: ${result.length}`);
                        if (result.length > 0) {
                            console.log(`[TEST] First result:`);
                            console.log(`  - id: ${result[0].id}`);
                            console.log(`  - label: ${result[0].label}`);
                        }
                        resolve(result);
                    } catch (e) {
                        console.error('[TEST] ❌ Parse error:', e.message);
                        reject(e);
                    }
                } else {
                    console.error(`[TEST] ❌ Status: ${res.statusCode}`);
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            console.error('[TEST] ❌ Connection error:', err.message);
            reject(err);
        });
    });
}

if (require.main === module) {
    Promise.all([
        testEndpoint(),
        testActionsEndpoint()
    ])
        .then(() => {
            console.log('\n[TEST] ✅ All tests completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[TEST] ❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testEndpoint, testActionsEndpoint };

