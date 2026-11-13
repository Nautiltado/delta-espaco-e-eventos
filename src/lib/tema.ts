/** Aparência salva no aparelho: claro (padrão), escuro ou automático (segue o sistema). */
export const CHAVE_TEMA = "delta-tema";
/** Menu lateral recolhido (só ícones) ou aberto, salvo no aparelho. */
export const CHAVE_LATERAL = "delta-lateral";

/** Roda antes da página aparecer: aplica tema e menu salvos e evita o "piscar". */
export const SCRIPT_TEMA = `(function(){var d=document.documentElement,t='claro',l='';try{t=localStorage.getItem('${CHAVE_TEMA}')||'claro';l=localStorage.getItem('${CHAVE_LATERAL}')||''}catch(e){}if(t!=='escuro'&&t!=='auto')t='claro';d.setAttribute('data-tema',t);if(l==='recolhida')d.setAttribute('data-lateral','recolhida')})();`;
