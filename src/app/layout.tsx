import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Special_Elite } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Duossie", template: "%s · Duossie" },
  description: "Duas perspectivas. Uma única verdade.",
  applicationName: "Duossie",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Duossie", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${plexSans.variable} ${plexMono.variable} ${specialElite.variable} antialiased`}
    >
      <body className="film-grain relative">
        <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
