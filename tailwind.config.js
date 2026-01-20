const defaultTheme = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')
const siteConfig = require('./config/site.config')

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: colors.black,
      white: colors.white,
      gray: colors.zinc,
      red: colors.rose,
      yellow: colors.amber,
      green: colors.green,
      blue: colors.sky,
      indigo: colors.indigo,
      purple: colors.purple,
      pink: colors.pink,
      teal: colors.teal,
      cyan: colors.cyan,
      orange: colors.orange,
    },
    extend: {
      fontFamily: {
        sans: [`"${siteConfig.googleFontSans}"`, '"Noto Sans SC"', ...defaultTheme.fontFamily.sans],
        mono: [`"${siteConfig.googleFontMono}"`, ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // Fluent Design 颜色系统
        fluent: {
          primary: {
            DEFAULT: '#0078D4',
            light: '#50E6FF',
            dark: '#005A9E',
          },
          secondary: {
            DEFAULT: '#E6E6E6',
            light: '#F2F2F2',
            dark: '#CCCCCC',
          },
          accent: {
            DEFAULT: '#D83B01',
            light: '#FF8C00',
            dark: '#C75000',
          },
          surface: {
            DEFAULT: '#FFFFFF',
            card: '#F3F2F1',
            panel: '#FAF9F8',
            overlay: '#00000099',
          },
          text: {
            primary: '#323130',
            secondary: '#605E5C',
            tertiary: '#A19F9D',
            disabled: '#C8C6C4',
          },
          border: {
            DEFAULT: '#EDEBE9',
            strong: '#8A8886',
            subtle: '#F3F2F1',
          },
        },
        gray: {
          850: '#222226',
        },
      },
      borderRadius: {
        'fluent-sm': '2px',
        'fluent-md': '4px',
        'fluent-lg': '8px',
        'fluent-xl': '12px',
        'fluent-2xl': '16px',
      },
      boxShadow: {
        'fluent-sm': '0 1px 2px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)',
        'fluent-md': '0 4px 8px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.08)',
        'fluent-lg': '0 8px 16px rgba(0,0,0,0.14), 0 0 4px rgba(0,0,0,0.08)',
        'fluent-xl': '0 12px 24px rgba(0,0,0,0.18), 0 0 6px rgba(0,0,0,0.12)',
        'fluent-inner': 'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
      },
      animation: {
        'spin-slow': 'spin 5s linear infinite',
        'fluent-enter': 'fluentEnter 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
        'fluent-exit': 'fluentExit 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)',
        'fluent-pulse': 'fluentPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fluentEnter: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fluentExit: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        fluentPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backdropBlur: {
        'fluent-sm': '4px',
        'fluent-md': '8px',
        'fluent-lg': '12px',
        'fluent-xl': '20px',
      },
      backdropBrightness: {
        'fluent-overlay': '0.8',
      },
      backdropSaturate: {
        'fluent-overlay': '1.2',
      },
    },
  },
  plugins: [],
}
