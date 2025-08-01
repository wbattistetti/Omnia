// Utility to lighten a hex color
export function getLightVersion(hex, percent = 0.7) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const newR = Math.round(r + (255 - r) * percent);
  const newG = Math.round(g + (255 - g) * percent);
  const newB = Math.round(b + (255 - b) * percent);
  return (
    '#' +
    [newR, newG, newB]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
  );
}