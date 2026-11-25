import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";

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
    "Remittances on Stellar with built-in savings. Your family receives USDC instantly, and a part is set aside for them on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by the init script before hydration, hence the warning opt-out.
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <I18nProvider>
            <WalletProvider>{children}</WalletProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
