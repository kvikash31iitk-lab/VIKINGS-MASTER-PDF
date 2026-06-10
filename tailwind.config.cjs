/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables so themes (light/dark/high-contrast)
        // can swap palettes without touching component code.
        app: {
          bg: 'var(--vk-bg)',
          surface: 'var(--vk-surface)',
          'surface-2': 'var(--vk-surface-2)',
          'surface-3': 'var(--vk-surface-3)',
          border: 'var(--vk-border)',
          'border-strong': 'var(--vk-border-strong)',
          text: 'var(--vk-text)',
          'text-muted': 'var(--vk-text-muted)',
          'text-faint': 'var(--vk-text-faint)',
          accent: 'var(--vk-accent)',
          'accent-hover': 'var(--vk-accent-hover)',
          'accent-muted': 'var(--vk-accent-muted)',
          'accent-text': 'var(--vk-accent-text)',
          danger: 'var(--vk-danger)',
          warning: 'var(--vk-warning)',
          success: 'var(--vk-success)',
          workspace: 'var(--vk-workspace)'
        }
      },
      fontFamily: {
        ui: ['Segoe UI Variable', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'ui-monospace', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      boxShadow: {
        flyout: 'var(--vk-shadow-flyout)',
        dialog: 'var(--vk-shadow-dialog)'
      },
      animation: {
        'fade-in': 'vk-fade-in 120ms ease-out',
        'slide-up': 'vk-slide-up 160ms cubic-bezier(0.1, 0.9, 0.2, 1)',
        'slide-down': 'vk-slide-down 160ms cubic-bezier(0.1, 0.9, 0.2, 1)'
      },
      keyframes: {
        'vk-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'vk-slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'vk-slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};
