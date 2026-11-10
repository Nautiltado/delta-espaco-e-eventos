import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Delta Gestão", template: "%s · Delta Gestão" },
  description: "Sistema de gestão da Delta Espaço e Eventos",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
