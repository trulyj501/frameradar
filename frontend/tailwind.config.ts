import type { Config } from "tailwindcss";

export default {
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        ember: "#D95F39",
        smoke: "#F3F4F6",
        slate: "#6B7280",
        paper: "#FFFFFF",
        primary: "#8B5CF6", // Purple
        primaryLight: "#A78BFA",
        secondaryPink: "#EC4899"
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "ui-sans-serif", "system-ui"],
        serif: ["'Newsreader'", "ui-serif", "Georgia"]
      },
      boxShadow: {
        panel: "0 18px 48px rgba(16, 18, 26, 0.12)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        rise: "rise 500ms ease-out"
      }
    }
  },
  plugins: []
} satisfies Config;
