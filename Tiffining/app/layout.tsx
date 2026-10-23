import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/app/providers";

const spaceGroteskHeading = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tiffining · Kitchen workspace",
  description: "Automated meal order reconciliation and daily dispatch desk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable,
        instrumentSans.variable,
        spaceGroteskHeading.variable
      )}
    >
      <body className="min-h-full min-w-0 flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
