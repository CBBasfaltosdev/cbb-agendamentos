# CBB Agendamentos

Plataforma genérica de agendamento de horários para a CBB Asfaltos. O primeiro módulo em
produção é o agendamento de massoterapia da **SIPAT 2026** (`sipat-2026-massagem`), mas o
sistema foi desenhado para servir qualquer outra campanha futura (reserva de sala, outro
evento de RH, etc.) **sem precisar alterar código** — basta cadastrar novas linhas no banco.

## Como funciona

- **Frontend**: Vite + React + TypeScript, publicado como site estático no GitHub Pages.
- **Backend**: Supabase (Postgres + Auth). Toda a comunicação com o Supabase fica isolada em
  [`src/lib/bookingService.ts`](src/lib/bookingService.ts) — se um dia a CBB decidir trocar de
  backend (ex: unificar com o `gestao.cbbasfaltos.com.br`), só esse arquivo precisa mudar.
- **Identificação do colaborador**: nome + e-mail corporativo. A confirmação é por link
  enviado por e-mail (Supabase Auth, sem senha) — o plano Free do Supabase não permite
  personalizar o e-mail para mostrar um código, então o login é "clique no link" em vez de
  "digite o código".

## Rodando localmente

```bash
npm install
npm run dev
```

As credenciais do Supabase estão em `.env` (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
Essas chaves são **públicas por design** (chave "publishable"/anon) — a segurança dos dados é
garantida por Row Level Security no banco, não pelo sigilo dessas chaves.

## Modelo de dados

| Tabela | Para quê |
|---|---|
| `eventos` | Cada campanha de agendamento (ex: SIPAT 2026 — Quick Massage) |
| `recursos` | Quem atende dentro do evento (ex: Massoterapeuta 1/2/3) |
| `pausas` | Janelas de horário bloqueadas para todos os recursos do evento |
| `slots` | Horários pré-gerados de cada recurso, já excluindo as pausas |
| `agendamentos` | Reserva de um colaborador em um slot (1 confirmado por slot, garantido por índice único) |

Disponibilidade é consultada via a função `slots_disponiveis(p_evento_slug)`, que devolve os
horários e se estão ocupados **sem expor dado pessoal de quem reservou** — é a única forma
pela qual o frontend, sem login, sabe o que está livre.

## Como cadastrar um novo evento/área

Não é preciso mexer no código do frontend. Insira diretamente no Supabase (SQL editor ou
`execute_sql`/`apply_migration` via MCP):

1. Uma linha em `eventos` (`slug`, `nome`, `data_inicio`, `data_fim`, `ativo = true`).
2. Uma linha em `recursos` por profissional/sala/recurso, ligada ao `evento_id`.
3. Linhas em `pausas` para os intervalos bloqueados (opcional).
4. Gerar os `slots` (ver exemplo em `supabase/seed/2026_09_03_sipat_massagem.sql`).

A tela `/#/evento/<slug>` fica disponível automaticamente assim que o evento existir e
`ativo = true`.

## Administração (v1)

Não existe painel administrativo ainda — quem organiza o evento (RH/SIPAT) acompanha os
agendamentos direto pela **Table Editor do Supabase**, na tabela `agendamentos`. Construir um
painel próprio fica para uma iteração futura, quando houver mais de um módulo em produção.

## Risco conhecido — validar antes de divulgar um novo evento

O envio do código de confirmação usa o e-mail padrão do Supabase Auth, que tem limite de
envio baixo e pode cair em spam corporativo. **Teste o recebimento do código em um e-mail
real @cbbasfaltos.com.br antes de divulgar o link** para os colaboradores. Se a entrega falhar,
configurar SMTP customizado no projeto Supabase (Authentication → Settings → SMTP).

## Deploy

Push na branch `main` dispara o workflow `.github/workflows/deploy.yml`, que builda o site e
publica no GitHub Pages do repositório.
