import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NoFeeSwap DEX",
  description: "Local NoFeeSwap DEX Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#1e1e2e] text-[#cdd6f4] min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
