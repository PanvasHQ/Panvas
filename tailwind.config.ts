/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panvas: {
          bg: {
            primary: 'rgb(var(--bg-primary) / <alpha-value>)',
            secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
            elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
            hover: 'rgb(var(--bg-hover) / <alpha-value>)',
            active: 'rgb(var(--bg-active) / <alpha-value>)',
          },
          border: {
            subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
            default: 'rgb(var(--border-default) / <alpha-value>)',
            strong: 'rgb(var(--border-strong) / <alpha-value>)',
          },
          text: {
            primary: 'rgb(var(--text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
            accent: 'rgb(var(--text-accent) / <alpha-value>)',
          },
          accent: {
            violet: 'rgb(var(--accent-violet) / <alpha-value>)',
            'violet-light': 'rgb(var(--accent-violet-light) / <alpha-value>)',
            blue: 'rgb(var(--accent-blue) / <alpha-value>)',
            emerald: 'rgb(var(--accent-emerald) / <alpha-value>)',
            amber: 'rgb(var(--accent-amber) / <alpha-value>)',
            rose: 'rgb(var(--accent-rose) / <alpha-value>)',
          },
          glass: {
            bg: 'rgb(var(--glass-bg) / <alpha-value>)',
            border: 'rgb(var(--glass-border) / <alpha-value>)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sketch: ['Caveat', 'cursive'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.85rem' }],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(-12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(124, 92, 252, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(124, 92, 252, 0.4)' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'glow-violet': '0 0 24px rgba(124, 92, 252, 0.25)',
        'glow-blue': '0 0 24px rgba(59, 130, 246, 0.25)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
