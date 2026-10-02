import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Synapse · Cognitive Sandbox",
    template: "%s · Synapse",
  },
  description:
    "A quiet space for deep scientific reasoning. SEAB-aligned Socratic method, no shortcuts.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Inter is loaded via globals.css @import from Google Fonts.
          Preconnect speeds up the font fetch.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
