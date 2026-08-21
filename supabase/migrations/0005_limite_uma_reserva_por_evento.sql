-- Aplicado em produção via Supabase MCP em 2026-08-22.
-- Decisão do usuário: bloquear mais de uma reserva confirmada por pessoa, por evento
-- (mudança da regra anterior, que era só um aviso leve). Reforçado no banco via trigger,
-- não só na tela — mais robusto contra corrida (duas abas, duplo clique) do que checagem
-- só no cliente antes de inserir.

create or replace function public.checar_uma_reserva_por_evento()
returns trigger
language plpgsql
as $$
declare
  v_evento_id uuid;
  v_ja_tem boolean;
begin
  if new.status <> 'confirmado' then
    return new;
  end if;

  select r.evento_id into v_evento_id
  from slots s join recursos r on r.id = s.recurso_id
  where s.id = new.slot_id;

  select exists (
    select 1
    from agendamentos a
    join slots s on s.id = a.slot_id
    join recursos r on r.id = s.recurso_id
    where a.colaborador_email = new.colaborador_email
      and a.status = 'confirmado'
      and r.evento_id = v_evento_id
      and a.id <> new.id
  ) into v_ja_tem;

  if v_ja_tem then
    raise exception 'colaborador ja possui uma reserva confirmada neste evento' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_uma_reserva_por_evento on public.agendamentos;
create trigger trg_uma_reserva_por_evento
  before insert or update on public.agendamentos
  for each row execute function public.checar_uma_reserva_por_evento();
