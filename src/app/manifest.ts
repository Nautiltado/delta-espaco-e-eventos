import type { MetadataRoute } from "next";

// Deixa o sistema instalável no celular e no computador ("Adicionar à tela inicial").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delta Gestão",
    short_name: "Delta",
    description: "Sistema de gestão da Delta Espaço e Eventos",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f0e6",
    theme_color: "#075638",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo pedido de salgado", short_name: "Pedido", url: "/salgados/novo" },
      { name: "Cozinha", url: "/salgados/cozinha" },
      { name: "Agenda", url: "/agenda" },
      { name: "Eventos", url: "/eventos" },
    ],
  };
}
