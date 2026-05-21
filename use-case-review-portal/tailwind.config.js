import path from 'path';

const omniaRoot = path.resolve(import.meta.dirname, '..');

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    path.join(omniaRoot, 'src/components/TaskEditor/EditorHost/editors/aiAgentEditor/**/*.{ts,tsx}'),
    path.join(omniaRoot, 'src/context/**/*.{ts,tsx}'),
    path.join(omniaRoot, 'src/components/TaskEditor/ResponseEditor/**/*.{ts,tsx}'),
  ],
  theme: { extend: {} },
  plugins: [],
};
