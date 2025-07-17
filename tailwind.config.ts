import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        copper: {
          DEFAULT: '#B87333',
          light: '#D2691E',
          dark: '#A0522D',
          50: '#FAF5F0',
          100: '#F5E6D3',
          200: '#E6C9A8',
          300: '#D4A574',
          400: '#C28147',
          500: '#B87333',
          600: '#A0522D',
          700: '#7B4025',
          800: '#5C3020',
          900: '#3D1F15',
        },
        whiskey: {
          50: '#FAF5F0',
          100: '#F5E6D3',
          200: '#E6C9A8',
          300: '#D4A574',
          400: '#C28147',
          500: '#B87333',
          600: '#A0522D',
          700: '#7B4025',
          800: '#5C3020',
          900: '#3D1F15',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(184, 115, 51, 0.5), 0 0 10px rgba(184, 115, 51, 0.3)' },
          '100%': { boxShadow: '0 0 10px rgba(184, 115, 51, 0.8), 0 0 20px rgba(184, 115, 51, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}

export default config