-- Aplicado em produção via Supabase MCP (apply_migration) em 2026-08-21.
-- O login deixou de coletar matrícula (a maioria dos colaboradores não sabe de cabeça) —
-- a coluna fica na tabela para quem preencheu antes, mas não é mais obrigatória.

alter table public.agendamentos alter column colaborador_matricula drop not null;
