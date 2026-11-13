import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const SUPABASE = "https://hlbkwlrooeffcjmfovlg.supabase.co";

/**
 * Política de conteúdo: o navegador só carrega código e dados do próprio sistema e do Supabase.
 * Barra páginas falsas que tentem embutir o sistema (frame-ancestors) e envio de formulário para fora.
 * 'unsafe-inline' em script é exigido pelo Next (dados da página vão inline); o resto fica fechado.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE}`,
  `frame-src 'self' blob: ${SUPABASE}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // só no site publicado (HTTPS); no computador de testes o endereço é http://localhost
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

const CABECALHOS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:caminho*", headers: CABECALHOS },
      // dados pessoais: nada de guardar em cache compartilhado
      { source: "/agenda/periodo", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default withBotId(nextConfig);
