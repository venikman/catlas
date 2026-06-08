import type { Metadata } from "next";
import "../styles/ontotwin-tokens.css";
import "../styles/ontotwin-kit.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "OntoTwin Atlas",
  description: "Dense semantic atlas for member ontology exploration.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
