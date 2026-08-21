-- Captura retroativa: aplicado em produção via Supabase MCP em 2026-08-21/22, mas nunca
-- tinha sido versionado no repositório até agora (schema real ficou divergente do que
-- alguém conseguiria reconstruir do zero lendo só as migrations anteriores).

create table if not exists public.admins (
  email text primary key,
  criado_em timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admins_le_proprio_email" on public.admins;
create policy "admins_le_proprio_email" on public.admins
  for select to authenticated
  using ((auth.jwt() ->> 'email') = email);

drop policy if exists "agendamentos_select_proprio" on public.agendamentos;
drop policy if exists "agendamentos_select_proprio_ou_admin" on public.agendamentos;
create policy "agendamentos_select_proprio_ou_admin" on public.agendamentos
  for select to authenticated
  using (
    (auth.jwt() ->> 'email') = colaborador_email
    or exists (select 1 from public.admins a where a.email = (auth.jwt() ->> 'email'))
  );

insert into public.admins (email) values ('agendamentos@cbbasfaltos.com.br')
on conflict (email) do nothing;

-- Reservas confirmadas do colaborador logado, só num evento (usado no aviso "você já tem
-- uma reserva aqui" dentro da tela do evento). Ver 0004 para a versão sem filtro de evento.
create or replace function public.minhas_reservas(p_evento_slug text)
returns table (
  id uuid,
  slot_id uuid,
  inicio time,
  fim time,
  data date,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.slot_id, s.inicio, s.fim, s.data, a.status, a.created_at
  from agendamentos a
  join slots s on s.id = a.slot_id
  join recursos r on r.id = s.recurso_id
  join eventos e on e.id = r.evento_id
  where e.slug = p_evento_slug
    and a.status = 'confirmado'
    and a.colaborador_email = (auth.jwt() ->> 'email')
  order by s.inicio;
$$;

grant execute on function public.minhas_reservas(text) to authenticated;
