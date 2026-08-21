-- Aplicado em produção via Supabase MCP em 2026-08-22.
-- Corrige o modelo de identidade: colaborador_nome ficava congelado em cada reserva (cópia
-- no momento da reserva), então corrigir o próprio nome fazia reservas antigas mostrarem
-- um nome diferente das novas no painel admin — de fora parecia "duas pessoas diferentes".
-- Especificado pelo cbb-auth-agendamento, ver PROJECTS/AGENDAMENTOS_SIPAT_2026.md.

alter table public.agendamentos
  add column if not exists colaborador_id uuid references auth.users(id);

update public.agendamentos a
set colaborador_id = u.id
from auth.users u
where u.email = a.colaborador_email
  and a.colaborador_id is null;

comment on column public.agendamentos.colaborador_nome is
  'Snapshot do nome no momento da reserva. NAO usar para exibicao -- usar colaborador_id + admin_listar_agendamentos(). Mantido so como fallback caso a conta seja removida.';

-- Painel admin: nome ATUAL do perfil (join com auth.users), nao o nome congelado na reserva.
create or replace function public.admin_listar_agendamentos()
returns table (
  id uuid,
  nome text,
  email text,
  status text,
  evento_nome text,
  data date,
  inicio time,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    coalesce(u.raw_user_meta_data ->> 'nome', a.colaborador_nome) as nome,
    a.colaborador_email,
    a.status,
    e.nome,
    s.data,
    s.inicio,
    a.created_at
  from agendamentos a
  join slots s on s.id = a.slot_id
  join recursos r on r.id = s.recurso_id
  join eventos e on e.id = r.evento_id
  left join auth.users u on u.id = a.colaborador_id
  where exists (select 1 from admins ad where ad.email = (auth.jwt() ->> 'email'))
  order by a.created_at desc;
$$;

grant execute on function public.admin_listar_agendamentos() to authenticated;

-- "Meus agendamentos": todas as reservas da pessoa, em qualquer evento (nao so o atual) --
-- base da tela /meus-agendamentos, acessivel pelo cabecalho, nao so de dentro de um evento.
create or replace function public.minhas_reservas_todas()
returns table (
  id uuid,
  slot_id uuid,
  evento_nome text,
  evento_slug text,
  data date,
  inicio time,
  fim time,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.slot_id, e.nome, e.slug, s.data, s.inicio, s.fim, a.created_at
  from agendamentos a
  join slots s on s.id = a.slot_id
  join recursos r on r.id = s.recurso_id
  join eventos e on e.id = r.evento_id
  where a.colaborador_email = (auth.jwt() ->> 'email')
    and a.status = 'confirmado'
  order by s.data, s.inicio;
$$;

grant execute on function public.minhas_reservas_todas() to authenticated;

-- Troca de horario atomica: cancela a reserva antiga e cria a nova na mesma transacao.
-- Nunca implementar troca como UPDATE direto de slot_id do cliente -- a policy de update
-- nao restringe coluna, e um UPDATE simples nao tem o fallback de tentar outro slot livre
-- que criarAgendamento() usa quando ha corrida por vaga.
create or replace function public.trocar_horario(p_agendamento_id uuid, p_novo_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from agendamentos
    where id = p_agendamento_id
      and colaborador_email = (auth.jwt() ->> 'email')
      and status = 'confirmado'
  ) then
    raise exception 'agendamento nao encontrado ou nao pertence ao usuario autenticado';
  end if;

  update agendamentos set status = 'cancelado' where id = p_agendamento_id;

  insert into agendamentos (slot_id, colaborador_nome, colaborador_email, colaborador_id)
  select p_novo_slot_id, colaborador_nome, colaborador_email, colaborador_id
  from agendamentos where id = p_agendamento_id;
end;
$$;

grant execute on function public.trocar_horario(uuid, uuid) to authenticated;
