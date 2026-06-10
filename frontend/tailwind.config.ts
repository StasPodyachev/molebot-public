import type { Config } from "tailwindcss";

/**
 * Tailwind CSS config — Molebot.Mantle
 *
 * Colour tokens mirror molebot.org:
 *   - mole.dark = body background (#1f2937)
 *   - mole.warm = amber-700 accent
 *   - tier.paper/cloud/dedicated = card tiers
 *   - mythic = MoleMascot animated border
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tier: {
          paper: "#6b7280",
          cloud: "#3b82f6",
          dedicated: "#f59e0b",
        },
        mythic: "#fbbf24",
        mole: {
          dark: "#1f2937",
          warm: "#a16207",
          50:  "#f3e8ff",
          100: "#e9d5ff",
          200: "#d8b4fe",
          300: "#c084fc",
          400: "#b06dff",
          500: "#9945ff",
          600: "#7c2fe8",
          700: "#6624c2",
          800: "#2a1a40",
          900: "#1a0d2e",
        },
      },
      keyframes: {
        "mythic-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251, 191, 36, 0.7)" },
          "50%": { boxShadow: "0 0 0 8px rgba(251, 191, 36, 0)" },
        },
      },
      animation: {
        "mythic-pulse": "mythic-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
