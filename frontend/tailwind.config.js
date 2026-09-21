/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0f172a", // Slate-900
          accent: "#10b981",  // Emerald-500
          accentHover: "#059669" // Emerald-600
        }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "sans-serif"],
        heading: ["Outfit", "sans-serif"]
      }
    }
  },
  plugins: []
};
