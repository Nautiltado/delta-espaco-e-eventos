import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { RegistrarSW } from "@/componentes/registrar-sw";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: { default: "Delta Gestão", template: "%s · Delta Gestão" },
  description: "Sistema de gestão da Delta Espaço e Eventos",
  robots: { index: false, follow: false },
  applicationName: "Delta Gestão",
  appleWebApp: { capable: true, title: "Delta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#164c3a" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1512" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-tema="claro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}<RegistrarSW /></body>
    </html>
  );
}
