import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROTAS_PUBLICAS = ["/entrar"];

/**
 * Renova a sessão do Supabase a cada requisição e manda para /entrar quem não está logado.
 * Permissões NÃO são decididas aqui: cada página e ação confere no servidor, e o banco confere de novo.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
            response.cookies.set(name, value, options),
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
  const metadados = (data?.claims?.user_metadata ?? {}) as { trocar_senha?: boolean };
  const caminho = request.nextUrl.pathname;
  if (logado && metadados.trocar_senha === true && caminho !== "/trocar-senha" && !publica) {
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
  matcher: ["/((?!_next/static|_next/image|icon.png|favicon.png|logo-.*\\.png).*)"],
};
