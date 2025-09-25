import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/client/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ClientProvider } from "@/components/client/client-provider";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CryptoExchange - Обмен криптовалют",
  description: "Быстрый и безопасный обмен криптовалют с лучшими курсами",
  keywords: "криптовалюта, обмен, биткоин, эфириум, USDT, USDC",
  authors: [{ name: "CryptoExchange Team" }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: "CryptoExchange - Обмен криптовалют",
    description: "Быстрый и безопасный обмен криптовалют с лучшими курсами",
    type: "website",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "CryptoExchange - Обмен криптовалют",
    description: "Быстрый и безопасный обмен криптовалют с лучшими курсами",
  },
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "white" },
      { media: "(prefers-color-scheme: dark)", color: "black" },
    ],
  }
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable}`}>
      <QueryProvider>
        <ClientProvider>
          {children}
          <Toaster 
            position="top-right"
            expand={true}
            richColors={true}
            closeButton={true}
          />
        </ClientProvider>
      </QueryProvider>
    </div>
  );
}