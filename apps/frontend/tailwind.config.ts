import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        ink: "#171717",
        canvas: "#f4f4f2",
        border: "#d8d7d2",
        muted: "#6e716b",
        accent: "#0f766e",
        accentSoft: "#d9f2ef",
      },
      boxShadow: {
        panel: "0 12px 30px rgba(23, 23, 23, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

