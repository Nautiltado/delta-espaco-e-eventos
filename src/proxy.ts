import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { COOKIE_VISITANTE, segredoDoVisitante, visitanteValido } from "@/lib/visitante-cookie";
import { protegerCookie } from "@/lib/supabase/cookies";
import { precisaTrocarSenha } from "@/lib/senha-flag";

const ROTAS_PUBLICAS = ["/entrar", "/convite/"];

/**
 * Renova a sessão do Supabase a cada requisição e manda para /entrar quem não está logado.
 * Permissões NÃO são decididas aqui: cada página e ação confere no servidor, e o banco confere de novo.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Visitante (cookie assinado pelo servidor): entra sem sessão do banco; troca de senha não se aplica.
  if (await visitanteValido(request.cookies.get(COOKIE_VISITANTE)?.value, segredoDoVisitante(), Date.now())) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, protegerCookie(options)),
          );
          Object.entries(headers).forEach(([chave, valor]) => response.headers.set(chave, valor));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logado = !!data?.claims?.sub;
  const publica = ROTAS_PUBLICAS.some((r) => request.nextUrl.pathname.startsWith(r));

  // Senha provisória: só a tela de troca (e a saída) ficam liberadas.
  const caminho = request.nextUrl.pathname;
  if (logado && precisaTrocarSenha(data?.claims as Parameters<typeof precisaTrocarSenha>[0]) && caminho !== "/trocar-senha" && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/trocar-senha";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|favicon.png|manifest.webmanifest|offline.html|sw.js|icone-.*\\.png|logo-.*\\.png).*)"],
};
