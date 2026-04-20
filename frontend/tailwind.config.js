/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        secondary: {
          500: '#0ea5e9',
          600: '#0284c7',
        },
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
      },
      backgroundImage: {
        primaryGradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 52%, #8b5cf6 100%)',
        blueGradient: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
        heroGradient: 'radial-gradient(circle at top left, rgba(79, 70, 229, 0.16), rgba(14, 165, 233, 0.12), rgba(255, 255, 255, 0.88))',
      },
      boxShadow: {
        glass: '0 12px 40px rgba(15, 23, 42, 0.12)',
        glow: '0 12px 30px rgba(99, 102, 241, 0.35)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(14px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 280ms ease-out',
        slideUp: 'slideUp 300ms ease-out',
        scaleIn: 'scaleIn 260ms ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
