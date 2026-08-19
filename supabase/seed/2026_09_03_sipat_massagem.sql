-- Aplicado em produção via Supabase MCP (execute_sql) em 2026-08-19.
-- Cadastra o evento "SIPAT 2026 — Quick Massage" (dia 03/09/2026), 3 profissionais em
-- paralelo, 08:30–18:00, sessões de 15 min, com as pausas das massoterapeutas excluídas
-- da grade de horários.

with novo_evento as (
  insert into public.eventos (slug, nome, descricao, data_inicio, data_fim, ativo)
  values (
    'sipat-2026-massagem',
    'SIPAT 2026 — Quick Massage',
    'Agendamento de massoterapia durante a SIPAT 2026. 3 profissionais em atendimento simultâneo, sessões de 15 minutos.',
    '2026-09-03', '2026-09-03', true
  )
  returning id
),
novos_recursos as (
  insert into public.recursos (evento_id, nome, ordem)
  select id, nome, ordem
  from novo_evento
  cross join (values ('Massoterapeuta 1', 1), ('Massoterapeuta 2', 2), ('Massoterapeuta 3', 3)) as r(nome, ordem)
  returning id, evento_id
)
insert into public.pausas (evento_id, inicio, fim)
select id, inicio, fim
from novo_evento
cross join (values ('09:45'::time, '10:00'::time), ('12:00'::time, '13:00'::time), ('15:30'::time, '15:45'::time)) as p(inicio, fim);

-- Geração dos slots roda em uma segunda instrução, para que a consulta a `pausas`
-- enxergue as pausas já confirmadas (dentro de uma mesma instrução, CTEs de escrita
-- não ficam visíveis para consultas que leem a tabela base pelo nome).
insert into public.slots (recurso_id, data, inicio, fim)
select r.id, d.dia, d.inicio, (d.inicio + interval '15 minutes')::time
from public.recursos r
join public.eventos e on e.id = r.evento_id
cross join lateral (
  select gs::date as dia, gs::time as inicio
  from generate_series(
    '2026-09-03 08:30'::timestamp,
    '2026-09-03 17:45'::timestamp,
    interval '15 minutes'
  ) gs
) d
where e.slug = 'sipat-2026-massagem'
and not exists (
  select 1 from public.pausas p
  where p.evento_id = e.id
    and d.inicio >= p.inicio and d.inicio < p.fim
);
