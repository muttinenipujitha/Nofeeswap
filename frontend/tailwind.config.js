/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "#1e1e2e",
        mantle: "#181825",
        crust: "#11111b",
        surface: {
          0: "#313244",
          1: "#45475a",
          2: "#585b70",
        },
        overlay: "#6c7086",
        text: "#cdd6f4",
        subtext: "#a6adc8",
        accent: "#6366f1",
        green: "#a6e3a1",
        red: "#f38ba8",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        mauve: "#cba6f7",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
