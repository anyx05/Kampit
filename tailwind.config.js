/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.{html,ejs}"],
  theme: {
    extend: {
      colors: {
        'primary': '#375441',
        'primary-lt': '#3A5A40',
        'secondary': '#588157',
        'secondary-lt': '#496E4C',
        'neutral': '#DAD7CD',
        'neutral-lt': '#CDCEBD',
        'info': '#A3B18A'
      }
    },

  },
  plugins: [],
}