export const sidebarTheme = {
  agentActs: {
    color: '#34d399',
    icon: 'user',
  },
  backendActions: {
    color: '#60a5fa',
    icon: 'database',
  },
  userActs: {
    color: '#a78bfa',
    icon: 'bot',
  },
  conditions: {
    color: '#facc15',
    icon: 'gitBranch',
  },
  tasks: {
    color: '#fb923c',
    icon: 'checkSquare',
  },
  macrotasks: {
    color: '#f87171',
    icon: 'layers',
  },
  ddt: {
    color: '#e879f9',
    icon: 'puzzle',
  },
};

export function getLightTone(hex: string, amount: number = 0.85): string {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const num = parseInt(hex, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.round(r + (255 - r) * amount);
  g = Math.round(g + (255 - g) * amount);
  b = Math.round(b + (255 - b) * amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const SIDEBAR_TYPE_COLORS = sidebarTheme;

export const SIDEBAR_TYPE_ICONS = {
  agentActs: 'bot',
  userActs: 'user',
  backendActions: 'database',
  conditions: 'gitBranch',
  tasks: 'checkSquare',
  macrotasks: 'layers',
  ddt: 'puzzle',
};
