import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#12161f', soft: '#4b5565', faint: '#8b94a6' },
        page: { DEFAULT: '#f6f7f9', card: '#ffffff', line: '#e3e6ec' },
        brand: { DEFAULT: '#1f4d7a', dark: '#163a5c', tint: '#eaf1f8' },
        ok: '#1f7a4d', warn: '#9a6b12', bad: '#a33232',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
