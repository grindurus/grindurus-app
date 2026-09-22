/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/landing/**/*.{ts,tsx}', './src/pages/LandingPage.tsx'],
  darkMode: 'class',
  // Scope utilities so landing Tailwind does not restyle /grai chrome.
  important: '.landing-root',
  corePlugins: {
    // Avoid global Preflight fighting app CSS after landing chunk loads.
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#ff69b4',
          red: '#ff1493',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #ff69b4, #ff1493)',
        shimmer: 'linear-gradient(90deg, #ff69b4, #ffffff, #ff1493, #ffffff, #ff69b4)',
        particle: 'linear-gradient(135deg, #ff69b4, #a78bfa)',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'marquee-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(calc(-100% / 4))' },
        },
        'orbit-infinity': {
          to: { marginLeft: '0' },
        },
        'grai-token-pulse': {
          '0%, 100%': { opacity: '0.28', transform: 'scale(0.72)' },
          '50%': { opacity: '1', transform: 'scale(1.18)' },
        },
        'grai-token-glow': {
          '0%, 100%': { opacity: '0.32' },
          '50%': { opacity: '1' },
        },
        'grai-holder-idle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'grai-lock-jiggle': {
          '0%, 70%, 100%': { transform: 'rotate(0deg)' },
          '76%': { transform: 'rotate(-10deg)' },
          '82%': { transform: 'rotate(7deg)' },
          '88%': { transform: 'rotate(-4deg)' },
        },
        'grai-disc-twist': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'grai-yield-l': {
          '0%': { opacity: '0', transform: 'translate3d(0, 10px, 0) scale(0.7)' },
          '12%': { opacity: '1', transform: 'translate3d(-8px, -8px, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate3d(-30px, -118px, 0) scale(0.9)' },
        },
        'grai-yield-r': {
          '0%': { opacity: '0', transform: 'translate3d(0, 10px, 0) scale(0.7)' },
          '12%': { opacity: '1', transform: 'translate3d(8px, -8px, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate3d(30px, -118px, 0) scale(0.9)' },
        },
        'grai-yield-c': {
          '0%': { opacity: '0', transform: 'translate3d(0, 8px, 0) scale(0.7)' },
          '12%': { opacity: '1', transform: 'translate3d(0, -12px, 0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate3d(6px, -128px, 0) scale(0.9)' },
        },
      },
      animation: {
        shimmer: 'shimmer 8s ease-in-out infinite',
        'marquee-scroll': 'marquee-scroll 30s linear infinite',
        'orbit-infinity': 'orbit-infinity 0s linear',
        'grai-token-pulse': 'grai-token-pulse 4.5s ease-in-out infinite',
        'grai-token-glow': 'grai-token-glow 3.4s ease-in-out infinite',
        'grai-holder-idle': 'grai-holder-idle 4.2s ease-in-out infinite',
        'grai-lock-jiggle': 'grai-lock-jiggle 5.2s ease-in-out infinite',
        'grai-disc-twist': 'grai-disc-twist 3.4s ease-in-out infinite',
        'grai-yield-l': 'grai-yield-l 4.8s ease-out infinite',
        'grai-yield-r': 'grai-yield-r 4.8s ease-out infinite',
        'grai-yield-c': 'grai-yield-c 4.8s ease-out infinite',
      },
      minHeight: {
        '70vh': '70vh',
      },
    },
  },
  plugins: [],
}
