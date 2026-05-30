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
            primary: '#0D0D0D',
            secondary: '#121212',
            tertiary: '#1A1A1A',
            elevated: '#222222',
            hover: '#171717',
            active: '#262626',
          },
          border: {
            subtle: 'rgba(255, 255, 255, 0.05)',
            default: '#262626',
            strong: 'rgba(255, 255, 255, 0.15)',
          },
          text: {
            primary: '#F5F5F5',
            secondary: '#A3A3A3',
            tertiary: '#737373',
            accent: '#F5F5F5',
          },
          accent: {
            violet: '#F5F5F5',
            'violet-light': '#ffffff',
            blue: '#3b82f6',
            emerald: '#10b981',
            amber: '#f59e0b',
            rose: '#f43f5e',
          },
          glass: {
            bg: 'rgba(18, 18, 18, 0.75)',
            border: '#262626',
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
  plugins: [],
}
