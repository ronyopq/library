/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Space Grotesk", "Noto Serif Bengali", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Sora", "Noto Serif Bengali", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        app: {
          bg: "#f5f7fb",
          text: "#1b2440",
          muted: "#5a678d",
          border: "#d8e0f2",
          surface: "#edf1fb",
          primary: "#365fcf",
          "primary-strong": "#2a4bad"
        }
      },
      boxShadow: {
        card: "0 20px 42px -28px rgba(24, 45, 96, 0.45)"
      }
    }
  },
  plugins: []
};
