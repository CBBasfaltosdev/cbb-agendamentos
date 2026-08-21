-- Aplicado em produção via Supabase MCP em 2026-08-22.
-- Achados de um review completo do repositório (skill /code-review, effort high):
--
-- 1) A policy "agendamentos_update_proprio" (0001) só checava dono da linha, não quais
--    colunas podiam mudar — um cliente com a chave anon podia chamar
--    `supabase.from('agendamentos').update({slot_id: X})` direto, contornando
--    trocar_horario()/criarAgendamento() e toda a lógica de concorrência/vínculo com evento
--    que elas implementam. O cliente só usa UPDATE para cancelar (status='cancelado'), então
--    restringe a permissão de UPDATE no nível de coluna.
--
-- 2) trocar_horario() (0004/0005) cancelava a reserva antiga e criava a nova sem checar que
--    o novo slot pertencia ao MESMO evento da reserva original — um p_novo_slot_id de outro
--    evento passava sem erro, movendo silenciosamente a pessoa para o evento errado.

revoke update on public.agendamentos from authenticated;
grant update (status) on public.agendamentos to authenticated;

create or replace function public.trocar_horario(p_agendamento_id uuid, p_novo_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento_atual uuid;
  v_evento_novo uuid;
begin
  select r.evento_id into v_evento_atual
  from agendamentos a
  join slots s on s.id = a.slot_id
  join recursos r on r.id = s.recurso_id
  where a.id = p_agendamento_id
    and a.colaborador_email = (auth.jwt() ->> 'email')
    and a.status = 'confirmado';

  if v_evento_atual is null then
    raise exception 'agendamento nao encontrado ou nao pertence ao usuario autenticado';
  end if;

  select r.evento_id into v_evento_novo
  from slots s join recursos r on r.id = s.recurso_id
  where s.id = p_novo_slot_id;

  if v_evento_novo is null or v_evento_novo <> v_evento_atual then
    raise exception 'o novo horario precisa ser do mesmo evento da reserva atual';
  end if;

  update agendamentos set status = 'cancelado' where id = p_agendamento_id;

  insert into agendamentos (slot_id, colaborador_nome, colaborador_email, colaborador_id)
  select p_novo_slot_id, colaborador_nome, colaborador_email, colaborador_id
  from agendamentos where id = p_agendamento_id;
end;
$$;

grant execute on function public.trocar_horario(uuid, uuid) to authenticated;
