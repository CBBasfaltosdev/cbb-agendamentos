-- Aplicado em produção via Supabase MCP (apply_migration) em 2026-08-19.
-- Este arquivo é a cópia de referência do schema para versionamento no repositório.

create extension if not exists pgcrypto;

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  descricao text,
  data_inicio date not null,
  data_fim date not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recursos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  ordem int not null default 0
);

create table public.pausas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  inicio time not null,
  fim time not null
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.recursos(id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time not null,
  unique (recurso_id, data, inicio)
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  colaborador_nome text not null,
  colaborador_matricula text not null,
  colaborador_email text not null,
  status text not null default 'confirmado' check (status in ('confirmado','cancelado')),
  created_at timestamptz not null default now()
);

-- garante que nunca haja dois agendamentos confirmados para o mesmo horario/profissional
create unique index agendamentos_slot_confirmado_uidx
  on public.agendamentos (slot_id)
  where status = 'confirmado';

create index agendamentos_email_idx on public.agendamentos (colaborador_email);

alter table public.eventos enable row level security;
alter table public.recursos enable row level security;
alter table public.pausas enable row level security;
alter table public.slots enable row level security;
alter table public.agendamentos enable row level security;

-- leitura publica (sem dado pessoal) para montar a tela de agendamento
create policy "eventos_leitura_publica" on public.eventos for select using (ativo);
create policy "recursos_leitura_publica" on public.recursos for select using (true);
create policy "pausas_leitura_publica" on public.pausas for select using (true);
create policy "slots_leitura_publica" on public.slots for select using (true);

-- agendamentos: colaborador so cria/le/cancela o proprio registro, apos verificar o e-mail por OTP
create policy "agendamentos_insert_proprio" on public.agendamentos
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = colaborador_email);

create policy "agendamentos_select_proprio" on public.agendamentos
  for select to authenticated
  using ((auth.jwt() ->> 'email') = colaborador_email);

create policy "agendamentos_update_proprio" on public.agendamentos
  for update to authenticated
  using ((auth.jwt() ->> 'email') = colaborador_email)
  with check ((auth.jwt() ->> 'email') = colaborador_email);

-- funcao publica: disponibilidade dos horarios de um evento, sem expor dado pessoal de quem reservou
create or replace function public.slots_disponiveis(p_evento_slug text)
returns table (
  slot_id uuid,
  recurso_id uuid,
  recurso_nome text,
  data date,
  inicio time,
  fim time,
  ocupado boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.recurso_id, r.nome, s.data, s.inicio, s.fim,
    exists (
      select 1 from agendamentos a
      where a.slot_id = s.id and a.status = 'confirmado'
    )
  from slots s
  join recursos r on r.id = s.recurso_id
  join eventos e on e.id = r.evento_id
  where e.slug = p_evento_slug and e.ativo
  order by s.data, s.inicio, r.ordem;
$$;

grant execute on function public.slots_disponiveis(text) to anon, authenticated;
