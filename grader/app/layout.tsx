import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Visibility Grader — Is Your Business Invisible to AI?",
  description:
    "Find out if ChatGPT and Gemini recommend your business when homeowners search for contractors near you. Free report in 90 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-[family-name:var(--font-inter)] bg-white text-[#102a2a]">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-[#ff735d] focus:text-black focus:font-bold focus:px-4 focus:py-3 focus:rounded-xl focus:outline-none">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
        <Script
          id="hs-script-loader"
          src="//js-na2.hs-scripts.com/246205545.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
