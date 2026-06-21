import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hoopfrens.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Hoop Frens | Everybody Hoops. Everyone's Welcome.", template: "%s | Hoop Frens" },
  description: "Basketball media covering JUCO, NAIA, NCAA Division II, NCAA Division III, NCCAA, and USCAA players, coaches, programs, and recruiting.",
  keywords: ["college basketball", "JUCO basketball", "NAIA basketball", "NCAA DII", "NCAA DIII", "NCCAA", "USCAA", "basketball recruiting"],
  openGraph: {
    type: "website",
    siteName: "Hoop Frens",
    title: "Hoop Frens | Everybody Hoops. Everyone's Welcome.",
    description: "Basketball media for the players, coaches, and programs beyond the usual spotlight.",
    url: siteUrl,
    images: [{ url: "/assets/hero_basketball.png", width: 1200, height: 630, alt: "Hoop Frens basketball coverage" }],
  },
  twitter: { card: "summary_large_image", title: "Hoop Frens | Everybody Hoops. Everyone's Welcome.", description: "Basketball media beyond the usual spotlight.", images: ["/assets/hero_basketball.png"] },
};

export const viewport: Viewport = { themeColor: "#050505", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Navbar /><main>{children}</main><Footer /></body></html>;
}
