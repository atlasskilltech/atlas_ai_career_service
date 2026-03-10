/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.ejs', './public/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          light: 'hsl(228 100% 20%)',
          dark: 'hsl(228 100% 8%)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          light: 'hsl(80 89% 50%)',
          dark: 'hsl(80 89% 30%)',
        },
        surface: {
          DEFAULT: 'hsl(var(--background))',
          card: 'hsl(228 30% 96%)',
          dark: 'hsl(228 30% 12%)',
        },
      },
    },
  },
  plugins: [],
};
