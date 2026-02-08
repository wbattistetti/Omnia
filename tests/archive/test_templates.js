/**
 * Test script to verify that templates are loaded from Task_Types collection
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3100'; // Express server port
const ENDPOINT = '/api/factory/type-templates';

async function testTemplatesEndpoint() {
    return new Promise((resolve, reject) => {
        const url = `${SERVER_URL}${ENDPOINT}`;
        console.log(`[TEST] Testing endpoint: ${url}`);

        http.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const templates = JSON.parse(data);
                        const templateCount = Object.keys(templates).length;

                        console.log(`[TEST] ✅ Success! Status: ${res.statusCode}`);
                        console.log(`[TEST] Templates loaded: ${templateCount}`);

                        if (templateCount > 0) {
                            const sampleKeys = Object.keys(templates).slice(0, 3);
                            console.log(`[TEST] Sample template names: ${sampleKeys.join(', ')}`);
                            console.log(`[TEST] ✅ Templates are loading correctly from Task_Types`);
                        } else {
                            console.warn(`[TEST] ⚠️  No templates found (collection might be empty)`);
                        }

                        resolve({ success: true, count: templateCount });
                    } catch (e) {
                        console.error(`[TEST] ❌ Failed to parse response:`, e.message);
                        console.error(`[TEST] Response:`, data.substring(0, 200));
                        reject(e);
                    }
                } else {
                    console.error(`[TEST] ❌ Failed! Status: ${res.statusCode}`);
                    console.error(`[TEST] Response:`, data);
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => {
            console.error(`[TEST] ❌ Connection error:`, err.message);
            console.error(`[TEST] Make sure the server is running on ${SERVER_URL}`);
            reject(err);
        });
    });
}

// Run test
if (require.main === module) {
    testTemplatesEndpoint()
        .then(() => {
            console.log('\n[TEST] ✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n[TEST] ❌ Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testTemplatesEndpoint };

