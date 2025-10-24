export function memoizeOne<A extends any[], R>(fn: (...a: A) => R) {
    let lastArgs: A | null = null;
    let lastRes: R;
    return (...args: A): R => {
        if (lastArgs && args.length === lastArgs.length && args.every((v, i) => v === lastArgs![i])) {
            return lastRes;
        }
        lastArgs = args;
        lastRes = fn(...args);
        return lastRes;
    };
}

