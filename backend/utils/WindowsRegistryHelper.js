// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const Registry = require('winreg');

/**
 * Windows Registry Helper
 * Replicates Python's Windows Registry fallback functionality
 */
class WindowsRegistryHelper {
    constructor() {
        this.registry = new Registry({
            hive: Registry.HKCU,
            key: '\\Environment'
        });
    }

    /**
     * Get environment variable with Windows Registry fallback
     * @param {string} keyName - Environment variable name
     * @returns {Promise<string|null>} Environment variable value or null
     */
    async getEnvVar(keyName) {
        try {
            // First try process.env
            const processValue = process.env[keyName];
            if (processValue) {
                console.log(`[REGISTRY] Found ${keyName} in process.env`);
                return processValue;
            }

            // Fallback to Windows Registry
            console.log(`[REGISTRY] Checking Windows Registry for ${keyName}`);

            return new Promise((resolve) => {
                this.registry.get(keyName, (err, item) => {
                    if (err) {
                        console.log(`[REGISTRY] ${keyName} not found in Registry`);
                        resolve(null);
                    } else if (item && item.value) {
                        console.log(`[REGISTRY] Found ${keyName} in Windows Registry`);
                        resolve(item.value);
                    } else {
                        console.log(`[REGISTRY] ${keyName} not found in Registry`);
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.warn(`[REGISTRY] Error reading ${keyName} from Registry:`, error.message);
            return null;
        }
    }

    /**
     * Get API key with multiple candidate names (like Python)
     * @param {Array<string>} candidates - Array of possible key names
     * @returns {Promise<string|null>} First found API key or null
     */
    async getApiKey(candidates) {
        for (const candidate of candidates) {
            const value = await this.getEnvVar(candidate);
            if (value) {
                console.log(`[REGISTRY] Using API key: ${candidate}`);
                return value;
            }
        }
        return null;
    }
}

module.exports = WindowsRegistryHelper;
