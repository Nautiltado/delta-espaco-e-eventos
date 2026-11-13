/** Perfis que só usam o sistema com senha + código do app autenticador (o banco confere o mesmo). */
export const PERFIS_COM_DUAS_ETAPAS = ["ADM", "FIN"];

export function exigeDuasEtapas(perfis: string[]): boolean {
  return perfis.some((p) => PERFIS_COM_DUAS_ETAPAS.includes(p));
}
