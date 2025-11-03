/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        'intent-xs': ['10px', { lineHeight: '14px' }],
        'intent-sm': ['12px', { lineHeight: '16px' }],
        'intent-base': ['14px', { lineHeight: '18px' }],
        'intent-md': ['16px', { lineHeight: '20px' }],
        'intent-lg': ['18px', { lineHeight: '22px' }],
      },
      fontFamily: {
        'intent-sans': ['Inter', 'system-ui', 'sans-serif'],
        'intent-serif': ['Georgia', 'serif'],
        'intent-mono': ['Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
