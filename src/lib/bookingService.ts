// Única camada que fala com o Supabase. Se um dia a CBB trocar o backend
// (ex: unificar com o gestao.cbbasfaltos.com.br), só este arquivo muda —
// as telas (src/pages) não sabem que o Supabase existe.

import { supabase } from './supabaseClient'

export const DOMINIO_CORPORATIVO = '@cbbasfaltos.com.br'

export type Evento = {
  slug: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string
}

export type SlotDisponivel = {
  slotId: string
  recursoId: string
  recursoNome: string
  data: string
  inicio: string
  fim: string
  ocupado: boolean
}

export type MinhaReserva = {
  id: string
  slotId: string
  inicio: string
  fim: string
  data: string
  createdAt: string
}

export type Periodo = 'manha' | 'tarde' | 'noite'

export type Horario = {
  inicio: string
  fim: string
  periodo: Periodo
  vagasLivres: number
  slotIdsLivres: string[]
}

function periodoDoHorario(inicio: string): Periodo {
  const hora = Number(inicio.slice(0, 2))
  if (hora < 12) return 'manha'
  if (hora < 18) return 'tarde'
  return 'noite'
}

export async function listarEventosAtivos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from('eventos')
    .select('slug, nome, descricao, data_inicio, data_fim')
    .order('data_inicio', { ascending: true })

  if (error) throw error

  return (data ?? []).map((e) => ({
    slug: e.slug,
    nome: e.nome,
    descricao: e.descricao,
    dataInicio: e.data_inicio,
    dataFim: e.data_fim,
  }))
}

export async function listarSlots(eventoSlug: string): Promise<SlotDisponivel[]> {
  const { data, error } = await supabase.rpc('slots_disponiveis', {
    p_evento_slug: eventoSlug,
  })

  if (error) throw error

  return (data ?? []).map((s: any) => ({
    slotId: s.slot_id,
    recursoId: s.recurso_id,
    recursoNome: s.recurso_nome,
    data: s.data,
    inicio: s.inicio,
    fim: s.fim,
    ocupado: s.ocupado,
  }))
}

// O colaborador escolhe um horário, não um profissional específico — o sistema aloca
// automaticamente entre quem estiver livre naquele horário (decisão de produto: o
// profissional não importa para quem está reservando).
export async function listarHorarios(eventoSlug: string): Promise<Horario[]> {
  const slots = await listarSlots(eventoSlug)
  const porHorario = new Map<string, Horario>()

  for (const s of slots) {
    if (!porHorario.has(s.inicio)) {
      porHorario.set(s.inicio, {
        inicio: s.inicio,
        fim: s.fim,
        periodo: periodoDoHorario(s.inicio),
        vagasLivres: 0,
        slotIdsLivres: [],
      })
    }
    if (!s.ocupado) {
      const h = porHorario.get(s.inicio)!
      h.vagasLivres += 1
      h.slotIdsLivres.push(s.slotId)
    }
  }

  return Array.from(porHorario.values()).sort((a, b) => a.inicio.localeCompare(b.inicio))
}

export function emailValido(email: string): boolean {
  const normalizado = email.trim().toLowerCase()
  return normalizado.endsWith(DOMINIO_CORPORATIVO) && normalizado.length > DOMINIO_CORPORATIVO.length
}

// O plano gratuito do Supabase não permite personalizar o e-mail para mostrar um código —
// só o link padrão "Confirm email address" funciona sem custo. Por isso o login é por link:
// o colaborador clica no e-mail e volta autenticado, em vez de digitar um código.
const SITE_URL = 'https://devcbbasfaltos.github.io/cbb-agendamentos/'
const CHAVE_CADASTRO_PENDENTE = 'cbb_cadastro_pendente'

export async function iniciarLogin(dados: { nome: string; email: string }): Promise<void> {
  sessionStorage.setItem(CHAVE_CADASTRO_PENDENTE, JSON.stringify({ nome: dados.nome.trim() }))

  const { error } = await supabase.auth.signInWithOtp({
    email: dados.email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: SITE_URL },
  })
  if (error) {
    sessionStorage.removeItem(CHAVE_CADASTRO_PENDENTE)
    throw error
  }
}

// Chamado assim que a sessão é detectada (depois do clique no link). Se o cadastro pendente
// estiver salvo neste mesmo navegador, aplica o nome automaticamente. Se o link foi aberto
// em outro aparelho/navegador, não há nada salvo — a tela de cadastro pede de novo.
export async function aplicarCadastroPendente(): Promise<void> {
  const bruto = sessionStorage.getItem(CHAVE_CADASTRO_PENDENTE)
  if (!bruto) return

  sessionStorage.removeItem(CHAVE_CADASTRO_PENDENTE)
  const dados = JSON.parse(bruto) as { nome: string }
  if (!dados.nome) return

  await supabase.auth.updateUser({ data: dados })
}

export async function salvarCadastro(dados: { nome: string }): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { nome: dados.nome.trim() },
  })
  if (error) throw error
}

export type Colaborador = {
  id: string
  email: string
  nome: string
}

export async function colaboradorAutenticado(): Promise<Colaborador | null> {
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user || !user.email) return null
  return {
    id: user.id,
    email: user.email,
    nome: (user.user_metadata?.nome as string) ?? '',
  }
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

// Reservas confirmadas do colaborador logado, só neste evento (não em outros que existam).
export async function minhasReservas(eventoSlug: string): Promise<MinhaReserva[]> {
  const { data, error } = await supabase.rpc('minhas_reservas', { p_evento_slug: eventoSlug })
  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id: r.id,
    slotId: r.slot_id,
    inicio: r.inicio,
    fim: r.fim,
    data: r.data,
    createdAt: r.created_at,
  }))
}

export type MinhaReservaTodas = {
  id: string
  slotId: string
  eventoNome: string
  eventoSlug: string
  data: string
  inicio: string
  fim: string
  createdAt: string
}

// "Meus agendamentos" de verdade: todas as reservas da pessoa, em qualquer evento — não só
// no evento em que ela está navegando agora.
export async function minhasReservasTodas(): Promise<MinhaReservaTodas[]> {
  const { data, error } = await supabase.rpc('minhas_reservas_todas')
  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id: r.id,
    slotId: r.slot_id,
    eventoNome: r.evento_nome,
    eventoSlug: r.evento_slug,
    data: r.data,
    inicio: r.inicio,
    fim: r.fim,
    createdAt: r.created_at,
  }))
}

// Troca atômica de horário (cancela o antigo + reserva o novo na mesma transação do banco).
// Tenta cada slot livre da lista até um funcionar, igual criarAgendamento — se todos já
// tiverem sido tomados, devolve 'sem_vaga' sem deixar a reserva antiga cancelada sem nada.
export async function trocarHorario(
  agendamentoId: string,
  slotIdsCandidatos: string[]
): Promise<{ ok: true } | { ok: false; motivo: 'sem_vaga' | 'erro' }> {
  for (const slotId of slotIdsCandidatos) {
    const { error } = await supabase.rpc('trocar_horario', {
      p_agendamento_id: agendamentoId,
      p_novo_slot_id: slotId,
    })
    if (!error) return { ok: true }
    if (error.code !== '23505') return { ok: false, motivo: 'erro' }
  }
  return { ok: false, motivo: 'sem_vaga' }
}

// Recebe todos os slot_id livres naquele horário (um por profissional) e tenta reservar
// o primeiro; se alguém reservou no meio do caminho (23505), tenta o próximo da lista.
// Os dados do colaborador vêm da sessão autenticada, não são mais digitados a cada reserva.
export async function criarAgendamento(
  slotIds: string[]
): Promise<
  { ok: true } | { ok: false; motivo: 'sem_vaga' | 'nao_autenticado' | 'ja_reservado' | 'erro' }
> {
  const colaborador = await colaboradorAutenticado()
  if (!colaborador) return { ok: false, motivo: 'nao_autenticado' }

  for (const slotId of slotIds) {
    const { error } = await supabase.from('agendamentos').insert({
      slot_id: slotId,
      colaborador_id: colaborador.id,
      colaborador_nome: colaborador.nome,
      colaborador_email: colaborador.email,
    })

    if (!error) return { ok: true }
    // P0001 = trigger do banco recusou por já existir uma reserva confirmada da mesma
    // pessoa neste evento — não adianta tentar outro slot da lista, o problema não é vaga.
    if (error.code === 'P0001') return { ok: false, motivo: 'ja_reservado' }
    if (error.code !== '23505') return { ok: false, motivo: 'erro' }
  }

  return { ok: false, motivo: 'sem_vaga' }
}

export async function cancelarAgendamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado' })
    .eq('id', id)
  if (error) throw error
}

// ===== Painel administrativo =====

export async function souAdmin(): Promise<boolean> {
  const { data, error } = await supabase.from('admins').select('email').maybeSingle()
  if (error) return false
  return !!data
}

export async function entrarComoAdmin(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
  if (error) throw error
}

export type AgendamentoAdmin = {
  id: string
  nome: string
  email: string
  status: 'confirmado' | 'cancelado'
  eventoNome: string
  data: string
  inicio: string
  createdAt: string
}

// Nome ATUAL do perfil de quem reservou (join com auth.users dentro da função), não o nome
// congelado no momento da reserva — assim corrigir o próprio nome não faz reservas antigas
// parecerem de outra pessoa. A checagem "é admin mesmo?" também vive dentro da função.
export async function listarTodosAgendamentos(): Promise<AgendamentoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_agendamentos')
  if (error) throw error

  return (data ?? []).map((a: any) => ({
    id: a.id,
    nome: a.nome,
    email: a.email,
    status: a.status,
    eventoNome: a.evento_nome ?? '—',
    data: a.data ?? '',
    inicio: a.inicio ?? '',
    createdAt: a.created_at,
  }))
}
