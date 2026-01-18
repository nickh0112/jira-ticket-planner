/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds - Parchment/Stone
        'stone-primary': '#2B2821',
        'stone-secondary': '#3D3629',
        'stone-panel': '#4A4136',
        'parchment': '#D4C4A8',

        // Primary UI - Gold/Bronze
        'gold': '#FFD700',
        'gold-dark': '#B8860B',
        'bronze': '#CD7F32',
        'copper': '#B87333',

        // Status Colors - Gem inspired
        'quest-new': '#FFD700',
        'quest-active': '#4FC3F7',
        'quest-complete': '#4CAF50',
        'quest-abandoned': '#9E9E9E',

        // Priority - Rarity colors
        'rarity-legendary': '#FF8C00',
        'rarity-epic': '#9C27B0',
        'rarity-rare': '#2196F3',
        'rarity-common': '#8BC34A',
        'rarity-basic': '#9E9E9E',

        // XP
        'xp-fill': '#7CFC00',
        'xp-bg': '#1A1A1A',

        // Text
        'beige': '#F5F5DC',
        'text-gold': '#FFD700',
        'text-dark': '#2B2821',

        // Borders
        'border-gold': '#B8860B',
        'border-dark': '#1A1612',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'monospace'],
        'readable': ['VT323', 'monospace'],
      },
      fontSize: {
        'pixel-xs': ['8px', { lineHeight: '12px' }],
        'pixel-sm': ['10px', { lineHeight: '14px' }],
        'pixel-base': ['12px', { lineHeight: '18px' }],
        'pixel-lg': ['14px', { lineHeight: '20px' }],
        'pixel-xl': ['16px', { lineHeight: '24px' }],
        'pixel-2xl': ['20px', { lineHeight: '28px' }],
      },
      boxShadow: {
        'pixel': '4px 4px 0 #1A1612',
        'pixel-sm': '2px 2px 0 #1A1612',
        'glow-gold': '0 0 10px rgba(255, 215, 0, 0.5)',
        'glow-legendary': '0 0 15px rgba(255, 140, 0, 0.4)',
        'glow-epic': '0 0 15px rgba(156, 39, 176, 0.4)',
        'glow-rare': '0 0 15px rgba(33, 150, 243, 0.4)',
        'glow-common': '0 0 8px rgba(139, 195, 74, 0.3)',
      },
      animation: {
        'float-up': 'float-up 1s ease-out forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'sparkle': 'sparkle 0.5s ease-in-out',
        'level-up': 'level-up-flash 1s ease-out forwards',
        'pixel-bounce': 'pixel-bounce 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
