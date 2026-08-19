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

export type MeuAgendamento = {
  id: string
  slotId: string
  status: 'confirmado' | 'cancelado'
  createdAt: string
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

export function emailValido(email: string): boolean {
  const normalizado = email.trim().toLowerCase()
  return normalizado.endsWith(DOMINIO_CORPORATIVO) && normalizado.length > DOMINIO_CORPORATIVO.length
}

export async function enviarCodigoConfirmacao(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function confirmarCodigo(email: string, codigo: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.trim(),
    type: 'email',
  })
  if (error) throw error
}

export async function meusAgendamentos(): Promise<MeuAgendamento[]> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select('id, slot_id, status, created_at')
    .eq('status', 'confirmado')

  if (error) throw error

  return (data ?? []).map((a) => ({
    id: a.id,
    slotId: a.slot_id,
    status: a.status,
    createdAt: a.created_at,
  }))
}

export async function criarAgendamento(params: {
  slotId: string
  nome: string
  matricula: string
  email: string
}): Promise<{ ok: true } | { ok: false; motivo: 'slot_ocupado' | 'erro' }> {
  const { error } = await supabase.from('agendamentos').insert({
    slot_id: params.slotId,
    colaborador_nome: params.nome.trim(),
    colaborador_matricula: params.matricula.trim(),
    colaborador_email: params.email.trim().toLowerCase(),
  })

  if (error) {
    if (error.code === '23505') return { ok: false, motivo: 'slot_ocupado' }
    return { ok: false, motivo: 'erro' }
  }

  return { ok: true }
}

export async function cancelarAgendamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado' })
    .eq('id', id)
  if (error) throw error
}
