/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        void: "#0B0C10",
        "slate-deep": "#0F1C21",
        "slate-mid": "#1E2F35",
        "slate-soft": "#2A3D43",
        "muted-teal": "#3D4F55",
        "ring-dim": "#3D5560",
        "ring-base": "#5C7A85",
        "ring-mid": "#7B9EA6",
        "ring-light": "#8AAAB2",
        "ring-bright": "#A8C4CB",
        "ring-pale": "#C5D5DA",
        "text-primary": "#C8D8DC",
        "text-secondary": "#A0B8BE",
        "success-green": "#4A8A6F",
        "error-red": "#8A4A4A",
      },
    },
  },
  plugins: [],
};
