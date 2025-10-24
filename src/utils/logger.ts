type Level = "off" | "error" | "warn" | "info" | "debug";
let CURRENT: Level = (import.meta.env?.VITE_LOG_LEVEL as Level) || "warn";

export function setLogLevel(l: Level) {
    CURRENT = l;
}

export function useLogger(ns: string) {
    const tag = `[${ns}]`;
    const should = (lvl: Level) => {
        const order: Level[] = ["off", "error", "warn", "info", "debug"];
        return order.indexOf(lvl) <= order.indexOf(CURRENT);
    };
    return {
        error: (...a: any[]) => should("error") && console.error(tag, ...a),
        warn: (...a: any[]) => should("warn") && console.warn(tag, ...a),
        info: (...a: any[]) => should("info") && console.info(tag, ...a),
        debug: (...a: any[]) => should("debug") && console.debug(tag, ...a),
    };
}

