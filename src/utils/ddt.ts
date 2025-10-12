export function isDDTEmpty(ddt?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return true;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);
    // Se esiste la struttura (mainData/mains), non è vuoto
    return mains.length === 0;
  } catch {
    return true;
  }
}


