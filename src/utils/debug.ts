export function isDebug(tag: string = 'flow'): boolean {
  try {
    const v = localStorage.getItem(`debug.${tag}`);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function dlog(tag: string, ...args: any[]) {
  if (!isDebug(tag)) return;
  try {
    // Prefix with tag for quick filtering
    console.log(`[${tag}]`, ...args);
  } catch {}
}


