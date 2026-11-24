/** HealthVeda colour theme: leaf green + saffron + warm cream. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        leaf: {
          50: "#f0f9f2", 100: "#dcf1e1", 200: "#bbe3c6", 300: "#8dcea2",
          400: "#5ab279", 500: "#37965b", 600: "#267847", 700: "#1f603b",
          800: "#1c4c31", 900: "#183f2a", 950: "#0b2317",
        },
        saffron: {
          50: "#fff8ed", 100: "#ffefd4", 200: "#ffdba8", 300: "#ffc070",
          400: "#ff9a37", 500: "#fd7c10", 600: "#ee6106", 700: "#c54808",
        },
        cream: "#fbf8f1",
        night: "#0f1a14",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Fraunces"', "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(31, 96, 59, 0.25)",
      },
    },
  },
  plugins: [],
};
