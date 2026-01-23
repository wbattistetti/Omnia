/**
 * 🚀 ENTERPRISE LOGGING SYSTEM
 *
 * Centralized logging with component filtering, log levels, and buffer management.
 * Prevents infinite log loops and provides granular control over logging.
 *
 * USAGE:
 * import { debug, info, warn, error } from '../utils/logger';
 *
 * debug('DDT_WIZARD', 'Message', { data });
 * error('DDT_WIZARD', 'Error occurred', error);
 *
 * GLOBAL ACCESS:
 * window.Logger.enable() // Enable all logs
 * window.Logger.disable() // Disable all logs
 * window.Logger.enableComponent('DDT_WIZARD') // Enable specific component
 * window.Logger.setLevel('info') // Set minimum log level
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Component =
    | 'MAIN'
    | 'DDT_WIZARD'
    | 'PROGRESS_MANAGER'
    | 'SCHEMA_MANAGER'
    | 'AUTO_MAPPING_SERVICE'
    | 'MAIN_DATA_WIZARD'
    | 'FLOW_EDITOR'
    | 'WIZARD_INPUT'
    | 'WIZARD_PIPELINE'
    | 'ORCHESTRATOR'
    | 'RESPONSE_EDITOR'
    | 'ALL';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    component: Component;
    message: string;
    details?: any[];
}

class Logger {
    private isEnabled: boolean = false; // DISABLED BY DEFAULT - Enable only when needed
    private logLevel: LogLevel = 'debug';
    private enabledComponents: Set<Component> = new Set(['ALL']);
    private logBuffer: LogEntry[] = [];
    private maxBufferSize: number = 1000;
    private tempEnableTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Make Logger globally accessible for console commands
        if (typeof window !== 'undefined') {
            (window as any).Logger = this;
        }
    }

    private shouldLog(level: LogLevel, component: Component): boolean {
        if (!this.isEnabled) return false;
        if (!this.enabledComponents.has('ALL') && !this.enabledComponents.has(component)) return false;

        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    private log(level: LogLevel, component: Component, message: string, ...details: any[]) {
        if (this.shouldLog(level, component)) {
            const now = new Date();
            const timestamp = now.toISOString();
            const logEntry: LogEntry = {
                timestamp,
                level,
                component,
                message,
                details: details.length > 0 ? details : undefined
            };

            this.logBuffer.push(logEntry);
            if (this.logBuffer.length > this.maxBufferSize) {
                this.logBuffer.shift(); // Remove oldest log
            }

            const logFn = console[level] || console.log;
            logFn(`[${timestamp}][${component}][${level.toUpperCase()}] ${message}`, ...details);
        }
    }

    public debug(component: Component, message: string, ...details: any[]) {
        this.log('debug', component, message, ...details);
    }

    public info(component: Component, message: string, ...details: any[]) {
        this.log('info', component, message, ...details);
    }

    public warn(component: Component, message: string, ...details: any[]) {
        this.log('warn', component, message, ...details);
    }

    public error(component: Component, message: string, ...details: any[]) {
        this.log('error', component, message, ...details);
    }

    public enable() {
        this.isEnabled = true;
        // ❌ RIMOSSO: log verboso all'avvio (mostrare solo se esplicitamente richiesto)
        // this.info('MAIN', 'Logger enabled globally.');
    }

    public disable() {
        this.isEnabled = false;
        // Don't log disable message to avoid infinite loop
    }

    public toggle() {
        this.isEnabled = !this.isEnabled;
        if (this.isEnabled) {
            this.info('MAIN', 'Logger toggled to enabled.');
        }
    }

    public setLevel(level: LogLevel) {
        this.logLevel = level;
        if (this.isEnabled) {
            // ❌ RIMOSSO: log verboso all'avvio (mostrare solo se esplicitamente richiesto)
            // this.info('MAIN', `Log level set to ${level.toUpperCase()}.`);
        }
    }

    public enableComponent(component: Component | 'ALL', ...components: Component[]) {
        if (component === 'ALL') {
            this.enabledComponents.clear();
            this.enabledComponents.add('ALL');
            if (this.isEnabled) {
                // ❌ RIMOSSO: log verboso all'avvio (mostrare solo se esplicitamente richiesto)
                // this.info('MAIN', 'All components enabled for logging.');
            }
        } else {
            this.enabledComponents.delete('ALL');
            this.enabledComponents.add(component);
            components.forEach(c => this.enabledComponents.add(c));
            if (this.isEnabled) {
                this.info('MAIN', `Enabled logging for components: ${[component, ...components].join(', ')}`);
            }
        }
    }

    public disableComponent(component: Component, ...components: Component[]) {
        this.enabledComponents.delete(component);
        components.forEach(c => this.enabledComponents.delete(c));
        if (this.isEnabled) {
            this.info('MAIN', `Disabled logging for components: ${[component, ...components].join(', ')}`);
        }
        if (this.enabledComponents.size === 0) {
            this.enabledComponents.add('ALL'); // Fallback to all if none are explicitly enabled
        }
    }

    public clear() {
        this.logBuffer = [];
        if (this.isEnabled) {
            this.info('MAIN', 'Log buffer cleared.');
        }
    }

    public getBuffer(): LogEntry[] {
        return [...this.logBuffer];
    }

    public getStats() {
        const stats = {
            isEnabled: this.isEnabled,
            logLevel: this.logLevel,
            enabledComponents: Array.from(this.enabledComponents),
            bufferSize: this.logBuffer.length,
            maxBufferSize: this.maxBufferSize,
            oldestLog: this.logBuffer.length > 0 ? this.logBuffer[0].timestamp : 'N/A',
            newestLog: this.logBuffer.length > 0 ? this.logBuffer[this.logBuffer.length - 1].timestamp : 'N/A',
        };
        if (this.isEnabled) {
            this.info('MAIN', 'Logger Stats', stats);
        }
        return stats;
    }

    public enableFor(durationMs: number) {
        this.enable();
        this.info('MAIN', `Logger enabled for ${durationMs / 1000} seconds.`);
        if (this.tempEnableTimer) {
            clearTimeout(this.tempEnableTimer);
        }
        this.tempEnableTimer = setTimeout(() => {
            this.disable();
            if (this.isEnabled) {
                this.info('MAIN', 'Logger automatically disabled after temporary period.');
            }
            this.tempEnableTimer = null;
        }, durationMs);
    }
}

export const logger = new Logger();

// Convenience exports matching the expected API
export const debug = (component: Component, message: string, ...details: any[]) => {
    logger.debug(component, message, ...details);
};

export const info = (component: Component, message: string, ...details: any[]) => {
    logger.info(component, message, ...details);
};

export const warn = (component: Component, message: string, ...details: any[]) => {
    logger.warn(component, message, ...details);
};

export const error = (component: Component, message: string, ...details: any[]) => {
    logger.error(component, message, ...details);
};

export const enableDebug = () => logger.enable();
export const disableDebug = () => logger.disable();
