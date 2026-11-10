-- Em gatilho BEFORE, colunas geradas ainda não estão calculadas em NEW. O total deriva de subtotal e desconto,
-- que continuam comparados; por isso total_centavos sai da comparação.
create or replace function trg_versao_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare livres text[] := array['status','aceita_em','aceite_registrado_por','total_centavos'];
begin
  if tg_op = 'DELETE' then
    raise exception 'ORCAMENTO_IMUTAVEL: versões não são excluídas' using errcode = 'P0001';
  end if;
  if old.status = 'rascunho' then
    if new.status = 'rascunho' and (new.subtotal_centavos, new.desconto_centavos)
         is distinct from (old.subtotal_centavos, old.desconto_centavos) then
      new.aprovado_por := null; new.aprovado_em := null;
      new.aprovacao_justificativa := null; new.aprovacao_motivos := null;
    end if;
    return new;
  end if;
  if (to_jsonb(new) - livres) <> (to_jsonb(old) - livres)
     or not ((old.status = 'enviada' and new.status in ('enviada','aprovada','substituida'))
          or (old.status = new.status)) then
    raise exception 'ORCAMENTO_IMUTAVEL: orçamento enviado não pode ser alterado; crie uma nova versão' using errcode = 'P0001';
  end if;
  return new;
end $$;
