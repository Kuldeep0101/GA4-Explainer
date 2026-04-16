import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GA4 Explainer — Plain-English GA4 Reports for Agencies",
  description: "Connect your GA4 property, get a plain-English performance report in seconds. Built for digital agencies.",
  icons: {
    icon: "/favicon.png",
  },
};

import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body>
        <Providers>
          <Toaster 
            position="bottom-right" 
            toastOptions={{
              className: '',
              style: {
                background: 'var(--card-bg)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)'
              },
            }} 
          />
          {children}
        </Providers>
      </body>
    </html>
  );
}
