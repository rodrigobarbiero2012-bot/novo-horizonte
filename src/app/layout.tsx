import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Novo Horizonte", template: "%s · Novo Horizonte" },
  description: "Gestão financeira, contábil e de produção do Sítio Novo Horizonte",
  robots: { index: false, follow: false },
  applicationName: "Novo Horizonte",
  appleWebApp: { capable: true, title: "Novo Horizonte", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#1c4332" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
