/**
 * Date Normalizer
 * Normalizza componenti di data:
 * - Converte mesi testuali/abbreviazioni in numeri (1-12)
 * - Normalizza anni a 2 cifre in 4 cifre (61 → 1961, 05 → 2005)
 * - Valida range (day: 1-31, month: 1-12, year: 1900-2100)
 *
 * NOTA: Il mapping mesi viene passato come parametro (dal DB, non hardcoded)
 */

export interface DateComponents {
  day?: number;
  month?: number;
  year?: number;
}

export interface NormalizeDateOptions {
  monthsMapping?: Record<string, number>;
}

/**
 * Normalizza i componenti di una data
 * @param components Componenti grezzi (day, month, year)
 * @param options Opzioni con mapping mesi (dal DB)
 * @returns Componenti normalizzati o null se invalido
 */
export function normalizeDate(
  components: Partial<DateComponents & { month?: number | string }>,
  options: NormalizeDateOptions = {}
): DateComponents | null {
  const { monthsMapping = {} } = options;
  const result: DateComponents = {};

  // Normalizza day
  if (components.day !== undefined && components.day !== null) {
    const day = typeof components.day === 'string' ? parseInt(components.day, 10) : components.day;
    if (isNaN(day) || day < 1 || day > 31) {
      return null; // Day invalido
    }
    result.day = day;
  }

  // Normalizza month (testuale → numero)
  if (components.month !== undefined && components.month !== null) {
    let month: number;

    if (typeof components.month === 'string') {
      // Prova come numero
      const monthNum = parseInt(components.month, 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        month = monthNum;
      } else {
        // Prova come nome/abbreviazione usando mapping dal DB
        const monthLower = components.month.toLowerCase().replace(/\.$/, ''); // Rimuovi punto finale
        month = monthsMapping[monthLower];
        if (!month) {
          return null; // Month invalido
        }
      }
    } else {
      month = components.month;
    }

    if (month < 1 || month > 12) {
      return null; // Month invalido
    }
    result.month = month;
  }

  // Normalizza year (2 cifre → 4 cifre)
  if (components.year !== undefined && components.year !== null) {
    let year = typeof components.year === 'string' ? parseInt(components.year, 10) : components.year;

    if (isNaN(year)) {
      return null; // Year invalido
    }

    // Normalizza anni a 2 cifre: < 50 → 2000+, >= 50 → 1900+
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    if (year < 1900 || year > 2100) {
      return null; // Year fuori range
    }
    result.year = year;
  }

  return Object.keys(result).length > 0 ? result : null;
}


