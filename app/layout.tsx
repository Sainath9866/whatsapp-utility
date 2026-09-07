import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Queue · WhatsApp Workspace",
  description: "Prepare personal WhatsApp messages and manage a shared send queue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>;
}
