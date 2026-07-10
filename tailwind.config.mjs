/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0b",
        panel: "#111114",
        panel2: "#16161b",
        text: "#e6e8ec",
        muted: "#8b909b",
        line: "#26262b",
        green: "#34d399",
        red: "#fb7185",
        gold: "#e5b567",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
