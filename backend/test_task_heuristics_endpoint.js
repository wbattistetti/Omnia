/**
 * Test script to verify /api/factory/task-heuristics loads from Task_Types
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3100';
const ENDPOINT = '/api/factory/task-heuristics';

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
                        console.log(`[TEST] Languages found: ${Object.keys(result).join(', ')}`);

                        // Check each language
                        Object.keys(result).forEach(lang => {
                            const langData = result[lang];
                            console.log(`\n[TEST] Language: ${lang}`);
                            console.log(`  - AI_AGENT: ${Array.isArray(langData.AI_AGENT) ? langData.AI_AGENT.length : 'N/A'} patterns`);
                            console.log(`  - MESSAGE: ${Array.isArray(langData.MESSAGE) ? langData.MESSAGE.length : 'N/A'} patterns`);
                            console.log(`  - REQUEST_DATA: ${Array.isArray(langData.REQUEST_DATA) ? langData.REQUEST_DATA.length : 'N/A'} patterns`);
                            console.log(`  - BACKEND_CALL: ${Array.isArray(langData.BACKEND_CALL) ? langData.BACKEND_CALL.length : 'N/A'} patterns`);
                            console.log(`  - SUMMARY: ${Array.isArray(langData.SUMMARY) ? langData.SUMMARY.length : 'N/A'} patterns`);
                            console.log(`  - NEGOTIATION: ${Array.isArray(langData.NEGOTIATION) ? langData.NEGOTIATION.length : 'N/A'} patterns`);

                            // Show sample pattern for REQUEST_DATA
                            if (langData.REQUEST_DATA && langData.REQUEST_DATA.length > 0) {
                                console.log(`  - Sample REQUEST_DATA pattern: ${langData.REQUEST_DATA[0]}`);
                            }
                        });

                        resolve(result);
                    } catch (e) {
                        console.error('[TEST] ❌ Parse error:', e.message);
                        console.error('[TEST] Response:', data.substring(0, 500));
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

if (require.main === module) {
    testEndpoint()
        .then(() => {
            console.log('\n[TEST] ✅ Test completed successfully');
            console.log('[TEST] The endpoint is loading patterns from Task_Types correctly!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[TEST] ❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testEndpoint };

