import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI CFO — Trial Balance Explainer",
  description: "Deterministic financial statements, ratios and scenarios from a trial balance, explained in plain language via AI Gateway.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
