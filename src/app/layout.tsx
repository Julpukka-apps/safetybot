import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafetyBot",
  description: "SafetyBot — speak or photograph a safety case and send a report.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "SafetyBot", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1565C0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
