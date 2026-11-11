import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "@/componentes/registrar-sw";

export const metadata: Metadata = {
  title: { default: "Delta Gestão", template: "%s · Delta Gestão" },
  description: "Sistema de gestão da Delta Espaço e Eventos",
  robots: { index: false, follow: false },
  applicationName: "Delta Gestão",
  appleWebApp: { capable: true, title: "Delta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#075638",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<RegistrarSW /></body>
    </html>
  );
}
