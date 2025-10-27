// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Advanced Health Checker for AI Providers
 * Provides comprehensive health monitoring
 */
class AIHealthChecker {
    constructor(aiProviderService, circuitBreakerManager, rateLimiter) {
        this.aiProvider = aiProviderService;
        this.circuitBreaker = circuitBreakerManager;
        this.rateLimiter = rateLimiter;
        this.healthHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Perform comprehensive health check
     * @returns {Object} Complete health status
     */
    async checkHealth() {
        const startTime = Date.now();
        const health = {
            status: 'healthy',
            providers: {},
            circuitBreakers: {},
            rateLimits: {},
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                timestamp: new Date().toISOString()
            },
            responseTime: 0
        };

        // Check each provider
        for (const provider of this.aiProvider.getAvailableProviders()) {
            try {
                const providerHealth = await this.checkProviderHealth(provider);
                health.providers[provider] = providerHealth;

                if (providerHealth.status !== 'healthy') {
                    health.status = 'degraded';
                }
            } catch (error) {
                health.providers[provider] = {
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                health.status = 'degraded';
            }
        }

        // Check circuit breakers
        health.circuitBreakers = this.circuitBreaker.getAllBreakerStatuses();

        // Check rate limits
        health.rateLimits = this.getRateLimitStatus();

        // Calculate response time
        health.responseTime = Date.now() - startTime;

        // Store in history
        this.addToHistory(health);

        return health;
    }

    /**
     * Check health of specific provider
     * @param {string} provider - Provider name
     * @returns {Object} Provider health status
     */
    async checkProviderHealth(provider) {
        const startTime = Date.now();

        try {
            // Test with minimal request
            const testMessages = [{ role: 'user', content: 'health check' }];
            await this.aiProvider.callAI(provider, testMessages, { timeout: 5000 });

            const latency = Date.now() - startTime;
            const metrics = this.aiProvider.getProviderMetrics(provider);
            const successRate = this.aiProvider.getProviderSuccessRate(provider);

            return {
                status: 'healthy',
                latency: latency,
                successRate: successRate,
                metrics: metrics,
                circuitBreaker: this.circuitBreaker.getBreakerStatus(provider),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                latency: Date.now() - startTime,
                circuitBreaker: this.circuitBreaker.getBreakerStatus(provider),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get rate limit status for all providers
     * @returns {Object} Rate limit status
     */
    getRateLimitStatus() {
        const status = {};
        for (const provider of this.aiProvider.getAvailableProviders()) {
            status[provider] = this.rateLimiter.getStatus(provider, 'global');
        }
        return status;
    }

    /**
     * Add health check to history
     * @param {Object} health - Health check result
     */
    addToHistory(health) {
        this.healthHistory.push(health);
        if (this.healthHistory.length > this.maxHistorySize) {
            this.healthHistory.shift();
        }
    }

    /**
     * Get health history
     * @param {number} limit - Number of recent checks to return
     * @returns {Array} Health history
     */
    getHealthHistory(limit = 10) {
        return this.healthHistory.slice(-limit);
    }

    /**
     * Get health trends
     * @returns {Object} Health trends analysis
     */
    getHealthTrends() {
        if (this.healthHistory.length < 2) {
            return { trend: 'insufficient_data', message: 'Need at least 2 health checks' };
        }

        const recent = this.healthHistory.slice(-5);
        const healthyCount = recent.filter(h => h.status === 'healthy').length;
        const degradedCount = recent.filter(h => h.status === 'degraded').length;

        let trend = 'stable';
        if (healthyCount === recent.length) {
            trend = 'improving';
        } else if (degradedCount === recent.length) {
            trend = 'degrading';
        } else if (degradedCount > healthyCount) {
            trend = 'declining';
        }

        return {
            trend: trend,
            healthyChecks: healthyCount,
            degradedChecks: degradedCount,
            totalChecks: recent.length,
            averageResponseTime: recent.reduce((sum, h) => sum + h.responseTime, 0) / recent.length
        };
    }

    /**
     * Get detailed health report
     * @returns {Object} Detailed health report
     */
    async getDetailedReport() {
        const health = await this.checkHealth();
        const trends = this.getHealthTrends();
        const history = this.getHealthHistory(20);

        return {
            current: health,
            trends: trends,
            history: history,
            summary: {
                overallStatus: health.status,
                providersCount: Object.keys(health.providers).length,
                healthyProviders: Object.values(health.providers).filter(p => p.status === 'healthy').length,
                systemUptime: health.system.uptime,
                memoryUsage: health.system.memory,
                responseTime: health.responseTime
            }
        };
    }

    /**
     * Reset health history
     */
    resetHistory() {
        this.healthHistory = [];
        console.log('[HEALTH_CHECKER] 🔄 Health history reset');
    }
}

module.exports = AIHealthChecker;
