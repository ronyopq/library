/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Hind Siliguri", "Noto Sans Bengali", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#f6fbf7",
          100: "#e7f6ea",
          200: "#c8eace",
          300: "#9bd7aa",
          400: "#64bd7e",
          500: "#3a9f5a",
          600: "#2b8248",
          700: "#24683c",
          800: "#215334",
          900: "#1c452c"
        },
        ink: {
          900: "#102218",
          700: "#2a3b31",
          500: "#596f62"
        },
        accent: {
          amber: "#f59e0b",
          rose: "#e11d48",
          blue: "#0284c7"
        }
      },
      boxShadow: {
        soft: "0 20px 45px -25px rgba(17, 40, 28, 0.45)"
      }
    }
  },
  plugins: []
};