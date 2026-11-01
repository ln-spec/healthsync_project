import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "HealthSync | Community care, connected", description: "Secure health coordination for barangay health workers." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
