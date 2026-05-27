import path from 'path';

/** PostCSS/Tailwind load this file via jiti (non-ESM) — avoid import.meta. */
const omniaRoot = path.resolve(process.cwd(), '..');

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    path.join(omniaRoot, 'src/components/**/*.{ts,tsx}'),
    path.join(omniaRoot, 'src/context/**/*.{ts,tsx}'),
    path.join(omniaRoot, 'packages/omnia-domain-components/src/**/*.{ts,tsx}'),
  ],
  theme: { extend: {} },
  plugins: [],
};
