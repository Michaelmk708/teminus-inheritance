import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        mono:    ["var(--font-dm-mono)", "Courier New", "monospace"],
        sans:    ["var(--font-instrument)", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0b0c10",
          2:       "#12131a",
          3:       "#1a1c26",
          4:       "#22253a",
        },
        gold: {
          DEFAULT: "#c9a96e",
          light:   "#e8cfa0",
        },
        cream:   "#e8e2d5",
        muted: {
          DEFAULT: "#7a7c8e",
          2:       "#4e5168",
        },
      },
      animation: {
        heartbeat:   "heartbeat 1.4s ease-in-out infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "fade-up":   "fadeUp 0.7s ease forwards",
        "pop-in":    "popIn 0.5s ease forwards",
        spin:        "spin 1.2s linear infinite",
      },
      keyframes: {
        heartbeat: {
          "0%,100%": { transform: "scale(1)" },
          "14%":     { transform: "scale(1.12)" },
          "28%":     { transform: "scale(1)" },
          "42%":     { transform: "scale(1.08)" },
          "56%":     { transform: "scale(1)" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0.4" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%":   { transform: "scale(0.6)", opacity: "0" },
          "70%":  { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)",   opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
