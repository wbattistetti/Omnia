export type Detected = { value: any; span?: [number, number] } | undefined;

export type KindParser = {
  detect: (text: string) => Detected;
  validate?: (value: any) => boolean;
};

const registry: Record<string, KindParser> = {};

export function registerKind(kind: string, parser: KindParser) {
  registry[kind] = parser;
}

export function getKind(kind: string): KindParser | undefined {
  return registry[kind];
}

// Built-in minimal detectors (starting set)
registerKind('date', {
  detect: (text: string) => {
    const re = /(\b\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
    const m = re.exec(text);
    if (!m) return undefined;
    return { value: `${m[1]}/${m[2]}/${m[3]}`, span: [m.index, m.index + m[0].length] };
  },
});

registerKind('email', {
  detect: (text: string) => {
    const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const m = re.exec(text);
    if (!m) return undefined;
    return { value: m[0], span: [m.index, m.index + m[0].length] };
  },
});

registerKind('phone', {
  detect: (text: string) => {
    const re = /\+?\d[\d\s\-]{6,}/g;
    const m = re.exec(text);
    if (!m) return undefined;
    return { value: m[0].trim(), span: [m.index, m.index + m[0].length] };
  },
});

registerKind('name', {
  detect: (text: string) => {
    const s = String(text || '');
    const m = s.match(/(?:mi\s+ch(?:ia|ai)mo|il\s+mio\s+nome\s+(?:e|è))\s+([A-Za-zÀ-ÿ'`-]+)(?:\s+([A-Za-zÀ-ÿ'`-]+))?/i);
    if (m) {
      const first = m[1];
      const last = m[2];
      const start = m.index ?? 0;
      const nameStr = [first, last].filter(Boolean).join(' ');
      const span: [number, number] = [s.indexOf(nameStr, start), (s.indexOf(nameStr, start) + nameStr.length)];
      return { value: { firstname: first, lastname: last }, span } as any;
    }
    return undefined;
  },
});


