import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="en" className={geistSans.variable}>
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
