export const tailwindToHex = (tw?: string): string | undefined => {
  if (!tw) return undefined;
  const map: Record<string, string> = {
    'text-blue-500': '#3b82f6',
    'text-purple-500': '#a21caf',
    'text-green-500': '#22c55e',
    'text-indigo-500': '#6366f1',
    'text-red-500': '#ef4444',
    'text-cyan-500': '#06b6d4',
    'text-blue-600': '#2563eb',
    'text-yellow-600': '#ca8a04',
    'text-teal-500': '#14b8a6',
    'text-violet-500': '#8b5cf6',
    'text-pink-500': '#ec4899',
    'text-gray-500': '#6b7280',
    'text-emerald-500': '#10b981',
    'text-orange-500': '#f59e42',
    'text-amber-500': '#f59e42',
    'text-lime-600': '#65a30d',
  };
  return map[tw] || undefined;
};

export const ensureHexColor = (input?: string): string | undefined => {
  if (!input) return undefined;
  if (input.startsWith('#')) return input;
  return tailwindToHex(input) || undefined;
};
