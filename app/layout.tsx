import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "CardScout",
  description:
    "Look up Pokémon card values from the TCGPlayer market and eBay sold prices, read recent TCG news, and find nearby Target, Walmart, and GameStop stores.",
  applicationName: "CardScout",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12151c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <body className="bg-desk font-sans text-paper antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-ink md:my-6 md:h-[calc(100dvh-3rem)] md:min-h-0 md:overflow-y-auto md:rounded-[32px] md:shadow-[0_30px_80px_rgba(48,38,18,0.28)] md:ring-1 md:ring-black/10">
          {children}
        </div>
      </body>
    </html>
  );
}
