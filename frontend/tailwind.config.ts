import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { blue: "#0038FF", ink: "#000000", mint: "#F7F8FA", teal: "#0038FF", canvas: "#F7F8FA" }, boxShadow: { card: "0 12px 40px rgba(0,56,255,.08)" } } }, plugins: [] };
export default config;
