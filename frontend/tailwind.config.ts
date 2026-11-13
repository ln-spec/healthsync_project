import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        blue: "#0038FF",
        ink: "#000000",
        mint: "#FFFFFF",
        teal: "#0038FF",
        canvas: "#FFFFFF",
      },
      boxShadow: { card: "0 12px 40px rgba(0,56,255,.08)" },
    },
  },
  plugins: [],
};
export default config;
