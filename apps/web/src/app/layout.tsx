import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Grow · Your money arrives, and takes root",
  description:
    "Remittances on Stellar that pay you back. Receive USDC instantly and let a part of it grow on its own, earning yield through DeFindex and Blend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
