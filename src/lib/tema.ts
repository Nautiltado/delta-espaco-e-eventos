/** Aparência salva no aparelho: claro, escuro ou automático (segue o sistema). */
export const CHAVE_TEMA = "delta-tema";

/** Roda antes da página aparecer: aplica o tema salvo e evita o "piscar" em branco. */
export const SCRIPT_TEMA = `(function(){var t='auto';try{t=localStorage.getItem('${CHAVE_TEMA}')||'auto'}catch(e){}if(t!=='claro'&&t!=='escuro')t='auto';document.documentElement.setAttribute('data-tema',t)})();`;
