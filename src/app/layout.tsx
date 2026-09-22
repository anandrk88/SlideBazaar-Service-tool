import type { Metadata } from "next";
import { after } from "next/server";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SiteChrome } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";
import { sweepAbandoned } from "@/lib/pabbly-sweep";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SlideBazaar Custom Design Services",
  description: "Professional presentation design on demand. Pay upfront, approve the final designs, and only then is the payment released to us. Full refund if you do not approve.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // The busiest request path in the app, and the project has no scheduler, so
  // this is where noticing that somebody gave up mostly happens. It is one
  // Setting read when nothing is due, and it runs after the response.
  after(async () => {
    await sweepAbandoned();
  });
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <SiteChrome
          header={<Header user={user} />}
          footer={
            <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-muted">
              <p>SlideBazaar Custom Design Services. We hold your payment and release it only after you approve your designs. Full refund if you do not.</p>
              <p className="mt-2">
                <a href="https://slidebazaar.com/privacy-policy/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                  Privacy Policy
                </a>
              </p>
            </footer>
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
