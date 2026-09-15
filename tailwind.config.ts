import type { Config } from 'tailwindcss';

/**
 * THE PALETTE IS VARIABLES, NOT HEX, so that high contrast is a swap of six
 * values in `globals.css` rather than a second stylesheet somebody has to
 * remember to keep in step. See lib/access/accessibility.ts.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token('ink'), soft: token('ink-soft'), faint: token('ink-faint') },
        page: { DEFAULT: token('page'), card: token('page-card'), line: token('page-line') },
        brand: { DEFAULT: token('brand'), dark: token('brand-dark'), tint: token('brand-tint') },
        ok: token('ok'), warn: token('warn'), bad: token('bad'),
      },
      fontFamily: {
        sans: ['var(--face)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
