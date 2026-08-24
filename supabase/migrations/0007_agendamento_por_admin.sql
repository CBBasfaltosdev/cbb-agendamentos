-- Aplicado em produção via Supabase MCP em 2026-08-24.
-- Demanda: parte do pessoal da fábrica não tem e-mail corporativo, então não passa pelo
-- login por link. O administrador consegue reservar um horário em nome dessa pessoa
-- direto na tela do evento, preenchendo só nome completo + setor (sem conta, sem e-mail).

alter table public.agendamentos add column if not exists colaborador_setor text;
alter table public.agendamentos alter column colaborador_email drop not null;

-- A policy "agendamentos_insert_proprio" (0001) só permite inserir quando
-- colaborador_email bate com o e-mail autenticado — nunca bate quando o admin está
-- inserindo em nome de um terceiro sem e-mail. Policies de INSERT são permissivas (OR),
-- então esta é uma porta adicional, exclusiva de quem está na tabela admins.
create policy "agendamentos_insert_admin" on public.agendamentos
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.email = (auth.jwt() ->> 'email')));

-- Sem isso, uma reserva de walk-in (sem conta, sem "meus agendamentos") nunca poderia ser
-- desfeita pela tela — só o admin consegue cancelar reservas de terceiros.
create or replace function public.admin_cancelar_agendamento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where email = (auth.jwt() ->> 'email')) then
    raise exception 'apenas administradores podem cancelar agendamentos de terceiros';
  end if;

  update agendamentos set status = 'cancelado' where id = p_id;
end;
$$;

grant execute on function public.admin_cancelar_agendamento(uuid) to authenticated;

-- admin_listar_agendamentos() ganha a coluna setor (precisa dropar antes: mudou o formato
-- de retorno, Postgres não deixa alterar o shape de uma função table-returning com CREATE OR REPLACE).
drop function if exists public.admin_listar_agendamentos();

create function public.admin_listar_agendamentos()
returns table (
  id uuid,
  nome text,
  email text,
  setor text,
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
    a.colaborador_setor,
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
